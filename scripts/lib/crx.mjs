/**
 * CRX3 打包实现（仅依赖 node:crypto）。
 *
 * 文件格式（见 Chromium components/crx_file/crx3.proto）：
 *   [4 字节] "Cr24"
 *   [4 字节] 版本号（小端，当前为 3）
 *   [4 字节] 头长度 N（小端）
 *   [N 字节] CrxFileHeader（protobuf）
 *   [M 字节] ZIP 压缩包
 *
 * 签名内容（RSA PKCS#1 v1.5 + SHA-256）：
 *   "CRX3 SignedData\0" + signed_header_data 长度（小端 int32）+ signed_header_data + ZIP
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
} from 'node:crypto'

/** CRX 文件魔数 */
export const CRX_MAGIC = 'Cr24'
/** CRX 格式版本 */
export const CRX_FORMAT_VERSION = 3
/** 签名前缀，含结尾的 \0 */
const SIGNATURE_CONTEXT = Buffer.from('CRX3 SignedData\u0000', 'latin1')
/** 扩展公钥算法与长度（Chrome 打包扩展同样使用 2048 位 RSA） */
const RSA_MODULUS_LENGTH = 2048

/** protobuf varint 编码 */
function varint(value) {
  const bytes = []
  let rest = value
  while (rest >= 0x80) {
    bytes.push((rest % 128) | 0x80)
    rest = Math.floor(rest / 128)
  }
  bytes.push(rest)
  return Buffer.from(bytes)
}

/** protobuf length-delimited 字段（wire type 2） */
function bytesField(fieldNumber, payload) {
  return Buffer.concat([varint(fieldNumber * 8 + 2), varint(payload.length), payload])
}

function uint32LE(value) {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(value >>> 0, 0)
  return buffer
}

/** CRX id：公钥（X.509 SubjectPublicKeyInfo）SHA-256 的前 16 字节 */
export function crxIdFromPublicKey(publicKeyDer) {
  return createHash('sha256').update(publicKeyDer).digest().subarray(0, 16)
}

/** 扩展 ID：crx id 每个半字节映射为 a-p 的字母 */
export function extensionIdFromPublicKey(publicKeyDer) {
  const crxId = crxIdFromPublicKey(publicKeyDer)
  let id = ''
  for (const byte of crxId) {
    id += String.fromCharCode(97 + (byte >> 4))
    id += String.fromCharCode(97 + (byte & 0x0f))
  }
  return id
}

/** 生成用于签名的 RSA 密钥对（PEM） */
export function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: RSA_MODULUS_LENGTH,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  return { publicKey, privateKey }
}

/** 从私钥 PEM 中导出 X.509 SubjectPublicKeyInfo（DER） */
export function publicKeyDerFrom(privateKeyPem) {
  const privateKey = createPrivateKey(privateKeyPem)
  return createPublicKey(privateKey).export({ type: 'spki', format: 'der' })
}

/**
 * 用 ZIP 内容生成 CRX3 包。
 * @param {{ zip: Buffer, privateKeyPem: string }} params
 * @returns {{ crx: Buffer, crxId: Buffer, extensionId: string }}
 */
export function packCrx({ zip, privateKeyPem }) {
  const privateKey = createPrivateKey(privateKeyPem)
  const publicKeyDer = publicKeyDerFrom(privateKeyPem)
  const crxId = crxIdFromPublicKey(publicKeyDer)

  // SignedData { crx_id = 1 }
  const signedHeaderData = bytesField(1, crxId)
  const signedPayload = Buffer.concat([
    SIGNATURE_CONTEXT,
    uint32LE(signedHeaderData.length),
    signedHeaderData,
    zip,
  ])

  const signature = cryptoSign('sha256', signedPayload, privateKey)

  // CrxFileHeader { sha256_with_rsa = 2, signed_header_data = 10000 }
  const proof = Buffer.concat([
    bytesField(1, publicKeyDer), // AsymmetricKeyProof.public_key
    bytesField(2, signature), // AsymmetricKeyProof.signature
  ])
  const header = Buffer.concat([
    bytesField(2, proof),
    bytesField(10000, signedHeaderData),
  ])

  const crx = Buffer.concat([
    Buffer.from(CRX_MAGIC, 'latin1'),
    uint32LE(CRX_FORMAT_VERSION),
    uint32LE(header.length),
    header,
    zip,
  ])

  return { crx, crxId, extensionId: extensionIdFromPublicKey(publicKeyDer) }
}

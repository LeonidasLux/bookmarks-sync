import { describe, it, expect, beforeAll } from 'vitest'
import { createHash, createPublicKey, verify } from 'node:crypto'
import {
  CRX_FORMAT_VERSION,
  CRX_MAGIC,
  crxIdFromPublicKey,
  extensionIdFromPublicKey,
  generateKeyPair,
  packCrx,
  publicKeyDerFrom,
} from '../../../scripts/lib/crx.mjs'

function readVarint(buffer, start) {
  let value = 0
  let shift = 1
  let index = start
  for (;;) {
    const byte = buffer[index++]
    value += (byte & 0x7f) * shift
    if (!(byte & 0x80)) break
    shift *= 128
  }
  return { value, next: index }
}

/** 解析 protobuf length-delimited 字段 */
function parseFields(buffer) {
  const fields = []
  let index = 0
  while (index < buffer.length) {
    const tag = readVarint(buffer, index)
    index = tag.next
    const fieldNumber = Math.floor(tag.value / 8)
    const length = readVarint(buffer, index)
    index = length.next
    fields.push({ fieldNumber, data: buffer.subarray(index, index + length.value) })
    index += length.value
  }
  return fields
}

/** 按 CRX3 规则解析 crx 文件 */
function parseCrx(crx) {
  const magic = crx.subarray(0, 4).toString('latin1')
  const version = crx.readUInt32LE(4)
  const headerLength = crx.readUInt32LE(8)
  const header = crx.subarray(12, 12 + headerLength)
  const archive = crx.subarray(12 + headerLength)

  const headerFields = parseFields(header)
  const proofFields = parseFields(headerFields.find(field => field.fieldNumber === 2).data)
  const signedHeaderData = headerFields.find(field => field.fieldNumber === 10000).data

  return {
    magic,
    version,
    headerLength,
    header,
    archive,
    publicKey: proofFields.find(field => field.fieldNumber === 1).data,
    signature: proofFields.find(field => field.fieldNumber === 2).data,
    signedHeaderData,
    crxId: parseFields(signedHeaderData).find(field => field.fieldNumber === 1).data,
  }
}

const zip = Buffer.from('PK\u0003\u0004 fake-zip-payload', 'latin1')
let privateKeyPem

beforeAll(() => {
  privateKeyPem = generateKeyPair().privateKey
})

describe('generateKeyPair', () => {
  it('生成 PKCS#8 私钥与 SPKI 公钥（PEM）', () => {
    const { publicKey, privateKey } = generateKeyPair()
    expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----')
    expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----')
  })
})

describe('crx id / 扩展 ID', () => {
  it('crx id 为公钥 SHA-256 的前 16 字节，扩展 ID 为 a-p 字母映射', () => {
    const publicKeyDer = publicKeyDerFrom(privateKeyPem)

    expect(crxIdFromPublicKey(publicKeyDer)).toEqual(
      createHash('sha256').update(publicKeyDer).digest().subarray(0, 16),
    )

    const extensionId = extensionIdFromPublicKey(publicKeyDer)
    expect(extensionId).toHaveLength(32)
    expect(extensionId).toMatch(/^[a-p]{32}$/)
  })
})

describe('packCrx', () => {
  it('生成 CRX3 文件头：魔数、版本、头长度与 ZIP 负载', () => {
    const { crx } = packCrx({ zip, privateKeyPem })
    const parsed = parseCrx(crx)

    expect(parsed.magic).toBe(CRX_MAGIC)
    expect(parsed.version).toBe(CRX_FORMAT_VERSION)
    expect(parsed.headerLength).toBe(parsed.header.length)
    expect(parsed.archive.equals(zip)).toBe(true)
    // CrxFileHeader 只包含 sha256_with_rsa(2) 与 signed_header_data(10000)
    expect(parseFields(parsed.header).map(field => field.fieldNumber)).toEqual([2, 10000])
  })

  it('signed_header_data 中的 crx_id 与公钥哈希一致', () => {
    const { crx, crxId, extensionId } = packCrx({ zip, privateKeyPem })
    const parsed = parseCrx(crx)

    expect(parsed.crxId.equals(crxId)).toBe(true)
    expect(parsed.crxId.equals(crxIdFromPublicKey(parsed.publicKey))).toBe(true)
    expect(extensionId).toBe(extensionIdFromPublicKey(parsed.publicKey))
  })

  it('签名覆盖 "CRX3 SignedData\\0" + 头长度 + signed_header_data + ZIP，可被公钥校验', () => {
    const { crx } = packCrx({ zip, privateKeyPem })
    const parsed = parseCrx(crx)

    const headerLength = Buffer.alloc(4)
    headerLength.writeUInt32LE(parsed.signedHeaderData.length, 0)
    const signedPayload = Buffer.concat([
      Buffer.from('CRX3 SignedData\u0000', 'latin1'),
      headerLength,
      parsed.signedHeaderData,
      parsed.archive,
    ])

    const publicKey = createPublicKey({ key: parsed.publicKey, format: 'der', type: 'spki' })
    expect(verify('sha256', signedPayload, publicKey, parsed.signature)).toBe(true)

    // 篡改 ZIP 后签名必须失效
    const tampered = Buffer.concat([signedPayload.subarray(0, signedPayload.length - 1), Buffer.from('!')])
    expect(verify('sha256', tampered, publicKey, parsed.signature)).toBe(false)
  })

  it('同一私钥可复现相同扩展 ID（RSA PKCS#1 签名确定性）', () => {
    const first = packCrx({ zip, privateKeyPem })
    const second = packCrx({ zip, privateKeyPem })

    expect(first.extensionId).toBe(second.extensionId)
    expect(first.crx.equals(second.crx)).toBe(true)
  })
})

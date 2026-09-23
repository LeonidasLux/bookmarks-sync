/**
 * 极简 ZIP 打包实现（仅依赖 node:zlib），用于生成扩展分发包。
 * 支持 deflate 压缩（压缩后更大时自动改存 store），文件名统一使用 `/` 分隔。
 */
import { deflateRawSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

/** 计算 CRC-32（ZIP 校验字段） */
export function crc32(buffer) {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** 把 Date 转换为 ZIP 使用的 DOS 时间 / 日期字段 */
function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear())
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time: time & 0xffff, day: day & 0xffff }
}

function normalizeEntryName(name) {
  const normalized = name.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.split('/').includes('..')) {
    throw new Error(`非法的 ZIP 条目名称: ${name}`)
  }
  return normalized
}

/**
 * 生成 ZIP 缓冲区。
 * @param {Array<{ name: string, data: Buffer | Uint8Array | string }>} entries
 * @param {{ date?: Date }} [options] 打包时间（默认当前时间，可固定以便复现）
 * @returns {Buffer}
 */
export function createZip(entries, options = {}) {
  const { date = new Date() } = options
  const { time, day } = toDosDateTime(date)

  const localChunks = []
  const centralChunks = []
  let offset = 0

  for (const entry of entries) {
    const name = normalizeEntryName(entry.name)
    const nameBuffer = Buffer.from(name, 'utf8')
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data)

    const deflated = deflateRawSync(raw, { level: 9 })
    const useDeflate = deflated.length < raw.length
    const body = useDeflate ? deflated : raw
    const method = useDeflate ? 8 : 0
    const checksum = crc32(raw)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4) // 解压所需版本 2.0
    localHeader.writeUInt16LE(0x0800, 6) // 文件名使用 UTF-8
    localHeader.writeUInt16LE(method, 8)
    localHeader.writeUInt16LE(time, 10)
    localHeader.writeUInt16LE(day, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(body.length, 18)
    localHeader.writeUInt32LE(raw.length, 22)
    localHeader.writeUInt16LE(nameBuffer.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localChunks.push(localHeader, nameBuffer, body)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(0x031e, 4) // 生成环境：UNIX + ZIP 3.0
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(method, 10)
    centralHeader.writeUInt16LE(time, 12)
    centralHeader.writeUInt16LE(day, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(body.length, 20)
    centralHeader.writeUInt32LE(raw.length, 24)
    centralHeader.writeUInt16LE(nameBuffer.length, 28)
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38) // 外部属性：-rw-r--r--
    centralHeader.writeUInt32LE(offset, 42)

    centralChunks.push(centralHeader, nameBuffer)
    offset += localHeader.length + nameBuffer.length + body.length
  }

  const centralDirectory = Buffer.concat(centralChunks)
  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0)
  endOfCentralDirectory.writeUInt16LE(entries.length, 8)
  endOfCentralDirectory.writeUInt16LE(entries.length, 10)
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12)
  endOfCentralDirectory.writeUInt32LE(offset, 16)

  return Buffer.concat([...localChunks, centralDirectory, endOfCentralDirectory])
}

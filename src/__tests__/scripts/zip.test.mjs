import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import { createZip, crc32 } from '../../../scripts/lib/zip.mjs'

/** 独立的 ZIP 解析实现（走中央目录），用于验证 createZip 产物 */
function readZip(buffer) {
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('未找到 ZIP 结束记录')

  const total = buffer.readUInt16LE(eocd + 10)
  let pointer = buffer.readUInt32LE(eocd + 16)
  const entries = []

  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error('中央目录记录签名错误')
    const method = buffer.readUInt16LE(pointer + 10)
    const checksum = buffer.readUInt32LE(pointer + 16)
    const compressedSize = buffer.readUInt32LE(pointer + 20)
    const uncompressedSize = buffer.readUInt32LE(pointer + 24)
    const nameLength = buffer.readUInt16LE(pointer + 28)
    const extraLength = buffer.readUInt16LE(pointer + 30)
    const commentLength = buffer.readUInt16LE(pointer + 32)
    const localOffset = buffer.readUInt32LE(pointer + 42)
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength)

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('本地文件头签名错误')
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const body = buffer.subarray(dataStart, dataStart + compressedSize)
    const data = method === 8 ? inflateRawSync(body) : body

    entries.push({ name, method, checksum, compressedSize, uncompressedSize, data })
    pointer += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

describe('crc32', () => {
  it('与 ZIP 标准测试向量一致', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
    expect(crc32(Buffer.from(''))).toBe(0)
  })
})

describe('createZip', () => {
  it('生成的压缩包可被解析，且文件名、内容、校验字段正确', () => {
    const compressible = Buffer.from('a'.repeat(2048))
    const zip = createZip([
      { name: 'manifest.json', data: compressible },
      { name: 'src/popup/index.html', data: Buffer.from('<html></html>') },
    ])

    const entries = readZip(zip)
    expect(entries.map(entry => entry.name)).toEqual(['manifest.json', 'src/popup/index.html'])

    const manifest = entries[0]
    expect(manifest.method).toBe(8)
    expect(manifest.data.equals(compressible)).toBe(true)
    expect(manifest.uncompressedSize).toBe(compressible.length)
    expect(manifest.compressedSize).toBeLessThan(manifest.uncompressedSize)
    expect(manifest.checksum).toBe(crc32(manifest.data))
    expect(entries[1].data.toString('utf8')).toBe('<html></html>')
  })

  it('不可压缩的数据回退为 store（不压缩）', () => {
    const zip = createZip([{ name: 'blob.bin', data: randomBytes(4096) }])

    const [entry] = readZip(zip)
    expect(entry.method).toBe(0)
    expect(entry.compressedSize).toBe(entry.uncompressedSize)
    expect(entry.checksum).toBe(crc32(entry.data))
  })

  it('统一文件名分隔符并拒绝越界路径', () => {
    const zip = createZip([{ name: '/assets\\app.js', data: Buffer.from('x') }])
    expect(readZip(zip)[0].name).toBe('assets/app.js')

    expect(() => createZip([{ name: '../evil.js', data: Buffer.from('x') }])).toThrow(/非法/)
    expect(() => createZip([{ name: '', data: Buffer.from('x') }])).toThrow(/非法/)
  })

  it('打包时间为固定值时产物可复现', () => {
    const date = new Date('2026-01-01T00:00:00Z')
    const files = [{ name: 'a.txt', data: Buffer.from('hello') }]

    expect(createZip(files, { date }).equals(createZip(files, { date }))).toBe(true)
  })
})

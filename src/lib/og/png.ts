// Minimal PNG encoder (truecolor + alpha, no interlace) for environments
// without a canvas, e.g. Cloudflare Workers. Compression comes from the
// platform's CompressionStream('deflate'), which produces the zlib framing
// PNG requires.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  })
  const compressed = source.pipeThrough(
    new CompressionStream('deflate') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
  )
  return new Uint8Array(await new Response(compressed as ReadableStream).arrayBuffer())
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** Encode an RGBA buffer (width * height * 4 bytes) as a PNG. */
export async function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array,
): Promise<Uint8Array> {
  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: truecolor with alpha
  // scanlines, each prefixed with filter type 0 (None)
  const raw = new Uint8Array(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4)
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), row + 1)
  }
  const idat = await deflate(raw)
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const parts = [
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

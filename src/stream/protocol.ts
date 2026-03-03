/**
 * 二進制幀協議
 *
 * 幀格式：
 *   [Magic 2B] [Type 1B] [Timestamp 4B] [Width 2B] [Height 2B] [Payload...]
 *
 * Full Frame payload:
 *   [DataLength 4B] [ImageData]
 *
 * Diff Frame payload:
 *   [GridCols 1B] [GridRows 1B] [DirtyCount 2B]
 *   repeat DirtyCount times: [Col 1B] [Row 1B] [DataLength 4B] [BlockData]
 */

/** 幀協議魔術數字 0xDC01 */
export const MAGIC = 0xdc01;

/** 幀類型 */
export enum FrameType {
  /** 完整幀 — 包含完整影像資料 */
  Full = 0x01,
  /** 差異幀 — 僅包含變化的區塊 */
  Diff = 0x02,
}

/** 差異幀中的 dirty block */
export interface DirtyBlock {
  col: number;
  row: number;
  data: Buffer;
}

/** 完整幀 */
export interface FullFrame {
  type: FrameType.Full;
  timestamp: number;
  width: number;
  height: number;
  data: Buffer;
}

/** 差異幀 */
export interface DiffFrame {
  type: FrameType.Diff;
  timestamp: number;
  width: number;
  height: number;
  gridCols: number;
  gridRows: number;
  blocks: DirtyBlock[];
}

export type Frame = FullFrame | DiffFrame;

/** Header 固定大小: magic(2) + type(1) + timestamp(4) + width(2) + height(2) = 11 bytes */
const HEADER_SIZE = 11;

/**
 * 編碼完整幀為 binary Buffer
 */
export function encodeFullFrame(frame: FullFrame): Buffer {
  const buf = Buffer.alloc(HEADER_SIZE + 4 + frame.data.length);
  let offset = 0;

  // Header
  buf.writeUInt16BE(MAGIC, offset); offset += 2;
  buf.writeUInt8(FrameType.Full, offset); offset += 1;
  buf.writeUInt32BE(frame.timestamp, offset); offset += 4;
  buf.writeUInt16BE(frame.width, offset); offset += 2;
  buf.writeUInt16BE(frame.height, offset); offset += 2;

  // Payload
  buf.writeUInt32BE(frame.data.length, offset); offset += 4;
  frame.data.copy(buf, offset);

  return buf;
}

/**
 * 編碼差異幀為 binary Buffer
 */
export function encodeDiffFrame(frame: DiffFrame): Buffer {
  // 計算總大小
  let payloadSize = 1 + 1 + 2; // gridCols + gridRows + dirtyCount
  for (const block of frame.blocks) {
    payloadSize += 1 + 1 + 4 + block.data.length; // col + row + dataLen + data
  }

  const buf = Buffer.alloc(HEADER_SIZE + payloadSize);
  let offset = 0;

  // Header
  buf.writeUInt16BE(MAGIC, offset); offset += 2;
  buf.writeUInt8(FrameType.Diff, offset); offset += 1;
  buf.writeUInt32BE(frame.timestamp, offset); offset += 4;
  buf.writeUInt16BE(frame.width, offset); offset += 2;
  buf.writeUInt16BE(frame.height, offset); offset += 2;

  // Payload header
  buf.writeUInt8(frame.gridCols, offset); offset += 1;
  buf.writeUInt8(frame.gridRows, offset); offset += 1;
  buf.writeUInt16BE(frame.blocks.length, offset); offset += 2;

  // Dirty blocks
  for (const block of frame.blocks) {
    buf.writeUInt8(block.col, offset); offset += 1;
    buf.writeUInt8(block.row, offset); offset += 1;
    buf.writeUInt32BE(block.data.length, offset); offset += 4;
    block.data.copy(buf, offset);
    offset += block.data.length;
  }

  return buf;
}

/**
 * 編碼任意幀
 */
export function encodeFrame(frame: Frame): Buffer {
  if (frame.type === FrameType.Full) {
    return encodeFullFrame(frame);
  }
  return encodeDiffFrame(frame);
}

/**
 * 解碼 binary Buffer 為幀
 */
export function decodeFrame(buf: Buffer): Frame {
  if (buf.length < HEADER_SIZE) {
    throw new ProtocolError(`Buffer too short: ${buf.length} < ${HEADER_SIZE}`);
  }

  let offset = 0;
  const magic = buf.readUInt16BE(offset); offset += 2;
  if (magic !== MAGIC) {
    throw new ProtocolError(`Invalid magic: 0x${magic.toString(16)}, expected 0x${MAGIC.toString(16)}`);
  }

  const type = buf.readUInt8(offset); offset += 1;
  const timestamp = buf.readUInt32BE(offset); offset += 4;
  const width = buf.readUInt16BE(offset); offset += 2;
  const height = buf.readUInt16BE(offset); offset += 2;

  if (type === FrameType.Full) {
    if (buf.length < offset + 4) {
      throw new ProtocolError('Buffer too short for full frame data length');
    }
    const dataLen = buf.readUInt32BE(offset); offset += 4;
    if (buf.length < offset + dataLen) {
      throw new ProtocolError(`Buffer too short for full frame data: need ${dataLen}, have ${buf.length - offset}`);
    }
    const data = buf.subarray(offset, offset + dataLen);
    return { type: FrameType.Full, timestamp, width, height, data: Buffer.from(data) };
  }

  if (type === FrameType.Diff) {
    if (buf.length < offset + 4) {
      throw new ProtocolError('Buffer too short for diff frame header');
    }
    const gridCols = buf.readUInt8(offset); offset += 1;
    const gridRows = buf.readUInt8(offset); offset += 1;
    const dirtyCount = buf.readUInt16BE(offset); offset += 2;

    const blocks: DirtyBlock[] = [];
    for (let i = 0; i < dirtyCount; i++) {
      if (buf.length < offset + 6) {
        throw new ProtocolError(`Buffer too short for dirty block ${i} header`);
      }
      const col = buf.readUInt8(offset); offset += 1;
      const row = buf.readUInt8(offset); offset += 1;
      const blockDataLen = buf.readUInt32BE(offset); offset += 4;
      if (buf.length < offset + blockDataLen) {
        throw new ProtocolError(`Buffer too short for dirty block ${i} data`);
      }
      const blockData = buf.subarray(offset, offset + blockDataLen);
      blocks.push({ col, row, data: Buffer.from(blockData) });
      offset += blockDataLen;
    }

    return { type: FrameType.Diff, timestamp, width, height, gridCols, gridRows, blocks };
  }

  throw new ProtocolError(`Unknown frame type: 0x${type.toString(16)}`);
}

/**
 * 協議錯誤
 */
export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

import { describe, it, expect } from 'vitest';
import {
  MAGIC,
  FrameType,
  encodeFullFrame,
  encodeDiffFrame,
  encodeFrame,
  decodeFrame,
  ProtocolError,
  type FullFrame,
  type DiffFrame,
} from '../../../src/stream/protocol.js';

describe('protocol', () => {
  const fullFrame: FullFrame = {
    type: FrameType.Full,
    timestamp: 1234567,
    width: 800,
    height: 600,
    data: Buffer.from('hello-image'),
  };

  const diffFrame: DiffFrame = {
    type: FrameType.Diff,
    timestamp: 9999,
    width: 1024,
    height: 768,
    gridCols: 8,
    gridRows: 6,
    blocks: [
      { col: 2, row: 3, data: Buffer.from('block1') },
      { col: 5, row: 1, data: Buffer.from('block2') },
    ],
  };

  describe('encodeFullFrame / decodeFrame roundtrip', () => {
    it('encodes and decodes a full frame correctly', () => {
      const encoded = encodeFullFrame(fullFrame);
      const decoded = decodeFrame(encoded);
      expect(decoded.type).toBe(FrameType.Full);
      expect(decoded.timestamp).toBe(1234567);
      expect(decoded.width).toBe(800);
      expect(decoded.height).toBe(600);
      expect((decoded as FullFrame).data.toString()).toBe('hello-image');
    });

    it('starts with correct magic bytes', () => {
      const encoded = encodeFullFrame(fullFrame);
      expect(encoded.readUInt16BE(0)).toBe(MAGIC);
    });
  });

  describe('encodeDiffFrame / decodeFrame roundtrip', () => {
    it('encodes and decodes a diff frame correctly', () => {
      const encoded = encodeDiffFrame(diffFrame);
      const decoded = decodeFrame(encoded) as DiffFrame;
      expect(decoded.type).toBe(FrameType.Diff);
      expect(decoded.timestamp).toBe(9999);
      expect(decoded.width).toBe(1024);
      expect(decoded.height).toBe(768);
      expect(decoded.gridCols).toBe(8);
      expect(decoded.gridRows).toBe(6);
      expect(decoded.blocks).toHaveLength(2);
      expect(decoded.blocks[0]!.col).toBe(2);
      expect(decoded.blocks[0]!.row).toBe(3);
      expect(decoded.blocks[0]!.data.toString()).toBe('block1');
      expect(decoded.blocks[1]!.col).toBe(5);
      expect(decoded.blocks[1]!.row).toBe(1);
      expect(decoded.blocks[1]!.data.toString()).toBe('block2');
    });

    it('encodes empty dirty blocks', () => {
      const frame: DiffFrame = { ...diffFrame, blocks: [] };
      const encoded = encodeDiffFrame(frame);
      const decoded = decodeFrame(encoded) as DiffFrame;
      expect(decoded.blocks).toHaveLength(0);
    });
  });

  describe('encodeFrame', () => {
    it('dispatches to encodeFullFrame for Full type', () => {
      const encoded = encodeFrame(fullFrame);
      const decoded = decodeFrame(encoded);
      expect(decoded.type).toBe(FrameType.Full);
    });

    it('dispatches to encodeDiffFrame for Diff type', () => {
      const encoded = encodeFrame(diffFrame);
      const decoded = decodeFrame(encoded);
      expect(decoded.type).toBe(FrameType.Diff);
    });
  });

  describe('decodeFrame error cases', () => {
    it('throws on buffer too short for header', () => {
      expect(() => decodeFrame(Buffer.alloc(5))).toThrow(ProtocolError);
      expect(() => decodeFrame(Buffer.alloc(5))).toThrow('Buffer too short');
    });

    it('throws on invalid magic', () => {
      const buf = Buffer.alloc(11);
      buf.writeUInt16BE(0xffff, 0);
      expect(() => decodeFrame(buf)).toThrow(ProtocolError);
      expect(() => decodeFrame(buf)).toThrow('Invalid magic');
    });

    it('throws on unknown frame type', () => {
      const buf = Buffer.alloc(11);
      buf.writeUInt16BE(MAGIC, 0);
      buf.writeUInt8(0xff, 2); // unknown type
      expect(() => decodeFrame(buf)).toThrow(ProtocolError);
      expect(() => decodeFrame(buf)).toThrow('Unknown frame type');
    });

    it('throws on truncated full frame data length', () => {
      const buf = Buffer.alloc(11);
      buf.writeUInt16BE(MAGIC, 0);
      buf.writeUInt8(FrameType.Full, 2);
      // no room for 4-byte data length
      expect(() => decodeFrame(buf)).toThrow('Buffer too short for full frame data length');
    });

    it('throws on truncated full frame data', () => {
      const buf = Buffer.alloc(15 + 2); // header(11) + dataLen(4) + partial data(2)
      buf.writeUInt16BE(MAGIC, 0);
      buf.writeUInt8(FrameType.Full, 2);
      buf.writeUInt32BE(100, 11); // claims 100 bytes
      expect(() => decodeFrame(buf)).toThrow('Buffer too short for full frame data');
    });

    it('throws on truncated diff frame header', () => {
      const buf = Buffer.alloc(12); // header(11) + 1 byte only
      buf.writeUInt16BE(MAGIC, 0);
      buf.writeUInt8(FrameType.Diff, 2);
      expect(() => decodeFrame(buf)).toThrow('Buffer too short for diff frame header');
    });

    it('throws on truncated dirty block header', () => {
      const buf = Buffer.alloc(15 + 2); // header(11) + gridCols(1) + gridRows(1) + dirtyCount(2) + partial(2)
      buf.writeUInt16BE(MAGIC, 0);
      buf.writeUInt8(FrameType.Diff, 2);
      buf.writeUInt8(8, 11); // gridCols
      buf.writeUInt8(6, 12); // gridRows
      buf.writeUInt16BE(1, 13); // 1 dirty block
      // only 2 bytes for block, need at least 6 (col+row+dataLen)
      expect(() => decodeFrame(buf)).toThrow('Buffer too short for dirty block 0 header');
    });

    it('throws on truncated dirty block data', () => {
      const buf = Buffer.alloc(15 + 6 + 1); // header(11) + diff header(4) + block header(6) + 1 partial byte
      buf.writeUInt16BE(MAGIC, 0);
      buf.writeUInt8(FrameType.Diff, 2);
      buf.writeUInt8(8, 11);
      buf.writeUInt8(6, 12);
      buf.writeUInt16BE(1, 13); // 1 dirty block
      buf.writeUInt8(0, 15); // col
      buf.writeUInt8(0, 16); // row
      buf.writeUInt32BE(100, 17); // claims 100 bytes data
      expect(() => decodeFrame(buf)).toThrow('Buffer too short for dirty block 0 data');
    });
  });

  describe('ProtocolError', () => {
    it('has correct name', () => {
      const err = new ProtocolError('test');
      expect(err.name).toBe('ProtocolError');
      expect(err.message).toBe('test');
      expect(err).toBeInstanceOf(Error);
    });
  });
});

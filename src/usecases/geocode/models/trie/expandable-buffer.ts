export class ExpandableBuffer {
  private offset: number;

  constructor(private buffer: Buffer) {
    this.offset = 0; // 現在の書き込み位置
  }

  size(): number {
    return this.offset;
  }

  read(offset: number, size: number): Buffer {
    return this.buffer.subarray(offset, offset + size);
  }

  copyTo(offset: number, dst: Buffer) {
    return this.buffer.copy(dst, 0, offset, offset + dst.length);
  }

  ensureCapacity(size: number) {
    if (this.offset + size < this.buffer.length) {
      return;
    }

    // 必要なサイズを計算
    const newSize = Math.max(this.buffer.length * 2, this.offset + size);

    // 新しいバッファを確保
    const newBuffer = Buffer.allocUnsafe(newSize);

    // 古いデータをコピー
    this.buffer.copy(newBuffer);

    this.buffer = newBuffer;
  }

  write(data: Buffer, offset: number) {
    const dataSize = data.length;
    this.ensureCapacity(dataSize);
    this.offset += dataSize;

    // データを書き込む
    data.copy(this.buffer, offset);
  }

  getBuffer() {
    return this.buffer.subarray(0, this.offset);
  }
}

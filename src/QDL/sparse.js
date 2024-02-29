import { concatUint8Array, readBlobAsBuffer } from "./utils";


const FILE_MAGIC = 0xed26ff3a;
const FILE_HEADER_SIZE = 28;
const CHUNK_HEADER_SIZE = 12;

export const ChunkType = {
  Raw : 0xCAC1,
  Fill : 0xCAC2,
  Skip : 0xCAC3,
  Crc32 : 0xCAC4,
}


export class QCSparse {
  constructor(blob) {
    this.blob = blob
    this.offset = 0;
    this.major_version = null;
    this.minor_version = null;
    this.file_hdr_sz = null;
    this.chunk_hdr_sz = null;
    this.blk_sz = null;
    this.total_blks = null;
    this.total_chunks = null;
    this.image_checksum = null;
    this.blobOffset = 0;
    this.tmpdata = new Uint8Array(0);
  }


  async parseFileHeader() {
    let header  = await readBlobAsBuffer(this.blob.slice(0, FILE_HEADER_SIZE));
    let view    = new DataView(header);

    let magic           = view.getUint32(0, true);
    this.major_version  = view.getUint16(4, true);
    this.minor_version  = view.getUint16(6, true);
    this.file_hdr_sz    = view.getUint16(8, true);
    this.chunk_hdr_sz   = view.getUint16(10, true);
    this.blk_sz         = view.getUint32(12, true);
    this.total_blks     = view.getUint32(16, true);
    this.total_chunks   = view.getUint32(20, true);
    this.image_checksum = view.getUint32(24, true);

    if (magic != FILE_MAGIC) {
        return false;
    }
    if (this.file_hdr_sz != FILE_HEADER_SIZE) {
      console.error(`The file header size was expected to be 28, but is ${this.file_hdr_sz}.`);
      return false;
    }
    if (this.chunk_hdr_sz != CHUNK_HEADER_SIZE) {
      console.error(`The chunk header size was expected to be 12, but is ${this.chunk_hdr_sz}.`);
      return false;
    }
    console.log("Sparse format detected. Using unpacked image.");
    return true;
  }


  async getChunkSize() {
    if (this.total_blks < this.offset) {
      console.error("Unmached output blocks");
      return -1;
    }

    let chunkHeader  = await readBlobAsBuffer(this.blob.slice(this.blobOffset, this.blobOffset + CHUNK_HEADER_SIZE));
    let view         = new DataView(chunkHeader);
    const chunk_type = view.getUint16(0, true);
    const chunk_sz   = view.getUint32(4, true);
    const total_sz   = view.getUint32(8, true);
    const data_sz    = total_sz - 12;
    this.blobOffset += CHUNK_HEADER_SIZE + data_sz;

    if (chunk_type == ChunkType.Raw) {
      if (data_sz != (chunk_sz*this.blk_sz)) {
        console.error("Rase chunk input size does not match output size");
        return -1;
      } else {
        if (this.blobOffset === CHUNK_HEADER_SIZE + data_sz + FILE_HEADER_SIZE)
          console.log("in raw");
        return data_sz;
      }
    } else if (chunk_type == ChunkType.Fill) {
      if (data_sz != 4) {
        console.error("Fill chunk should have 4 bytes of fill");
        return -1;
      } else {
        //return Math.floor((chunk_sz * this.blk_sz)/4);
        return data_sz;
      }
    } else if (chunk_type == ChunkType.Skip) {
      return data_sz;
    } else if (chunk_type == ChunkType.Crc32) {
      if (data_sz != 4) {
        console.error("CRC32 chunk should have 4 bytes of CRC");
        return -1;
      } else {
        return 0;
      }
    } else {
      console.error("Unknown chunk type");
      return -1;
    }
  }


  async getSize() {
    this.blobOffset = FILE_HEADER_SIZE;
    let length = 0, chunk = 0;
    while (chunk < this.total_chunks) {
      let tlen = await this.getChunkSize();
      if (tlen == -1)
        break;
      length += tlen;
      chunk += 1;
    }
    this.blobOffset = FILE_HEADER_SIZE;
    return length;
  }


  async unsparse(maxLen) {
    if (this.total_blks < this.offset) {
      console.error("Error while unsparsing");
      return -1;
    }

    let chunkHeader  = await readBlobAsBuffer(this.blob.slice(this.blobOffset, this.blobOffset += CHUNK_HEADER_SIZE));
    let view         = new DataView(chunkHeader);
    const chunk_type = view.getUint16(0, true);
    const chunk_sz   = view.getUint32(4, true);
    const total_sz   = view.getUint32(8, true);
    const data_sz    = total_sz - 12;

    if (chunk_type == ChunkType.Raw) {
      if (data_sz != (chunk_sz*this.blk_sz)) {
        console.error("Rase chunk input size does not match output size");
        yield -1;
        return;
      } else {
        if (data_sz <= maxLen) {
          const buffer  = await readBlobAsBuffer(this.blob.slice(this.blobOffset, this.blobOffset += data_sz));
          const data = new Uint8Array(buffer);
          yield data;
          return;
        }
        let byteToWrite = data_sz;
        while (byteToWrite > 0) {
          let wlen = Math.min(maxLen, byteToWrite);
          const buffer  = await readBlobAsBuffer(this.blob.slice(this.blobOffset, this.blobOffset += wlen));
          const data    = new Uint8Array(buffer);
          byteToWrite -= wlen;
          yield data;
        }
        this.offset += chunk_sz;
      }
    } else if (chunk_type == ChunkType.Fill) {
      if (data_sz != 4) {
        console.error("Fill chunk should have 4 bytes of fill");
        yield new Uint8Array(0);
      } else {
        const buffer = await readBlobAsBuffer(this.blob.slice(this.blobOffset, this.blobOffset += 4));
        let fill_bin = new Uint8Array(buffer);
        const repetitions = Math.floor((chunk_sz*this.blk_sz)/4);
        let data = new Uint8Array(0);
        for (let i = 0; i < repetitions; i++) {
          data = concatUint8Array([data, fill_bin]);
          if (data.length >= maxLen) {
            yield data;
            data = new Uint8Array(0);
          }
        }
        this.offset += chunk_sz;
        if (data.length > 0)
          yield data;
      }
    } else if (chunk_type == ChunkType.Skip) {
      let byteToSend = chunk_sz*this.blk_sz;
      if (byteToSend <= maxLen) {
        yield new Uint8Array(byteToSend).fill(0x00);
        return;
      }
      while (byteToSend > 0) {
        let wlen     = Math.min(maxLen, byteToSend);
        byteToWrite -= wlen
        yield new Uint8Array(wlen).fill(0x00);
      }
      this.offset += chunk_sz;
    } else if (chunk_type == ChunkType.Crc32) {
      if (data_sz != 4) {
        console.error("CRC32 chunk should have 4 bytes of CRC");
        yield -1;
      } else {
        this.blobOffset += 4;
        yield new Uint8Array(0);
      }
    } else {
      console.error("Unknown chunk type");
      yield -1;
    }
  }


  async read(length=null) {
    let tdata;
    if (length === null)
      return await this.unsparse();
    if (length <= this.tmpdata.length) {
      tdata = this.tmpdata.slice(0, length);
      this.tmpdata = this.tmpdata.slice(length);
      return tdata;
    }
    while (this.tmpdata.length < length) {
      for (const data of await this.unsparse()) {
        this.tmpdata = concatUint8Array([this.tmpdata, data])
        console.log("tmpdata: ", this.tmpdata)
        if (length <= this.tmpdata.length) {
          tdata = this.tmpdata.slice(0, length);
          this.tmpdata = this.tmpdata.slice(length);
          return tdata;
        }
      }
    }
  }
}
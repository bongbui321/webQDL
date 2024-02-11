export class structHelper_io {
  data;
  direction;

  constructor(data) {
    this.data = data;
  }

  dword(idx_start) {
    // TODO: check endianess
    dat = new TextDecoder('utf-8').decode(data).substring(idx_start, idx_start + 4 - 1);
    return dat;
  }

  qword(idx_start) {
    dat = new TextDecoder('utf-8').decode(data).substring(idx_start, idx_start + 8 - 1);
    return dat;
  }

}
import { structHelper_io } from "./utils"

export const cmd_t = {
  SAHARA_HELLO_REQ : 0x1,
  SAHARA_HELLO_RSP : 0x2,
  SAHARA_READ_DATA : 0x3,
  SAHARA_END_TRANSFER : 0x4,
  SAHARA_DONE_REQ : 0x5,
  SAHARA_DONE_RSP : 0x6,
  //SAHARA_RESET_REQ : 0x7,
  SAHARA_RESET_RSP : 0x8,
  //SAHARA_MEMORY_DEBUG : 0x9,
  //SAHARA_MEMORY_READ : 0xA,
  SAHARA_CMD_READY : 0xB,
  SAHARA_SWITCH_MODE : 0xC,
  SAHARA_EXECUTE_REQ : 0xD,
  SAHARA_EXECUTE_RSP : 0xE,
  SAHARA_EXECUTE_DATA : 0xF,
  //SAHARA_64BIT_MEMORY_DEBUG : 0x10,
  //SAHARA_64BIT_MEMORY_READ : 0x11,
  SAHARA_64BIT_MEMORY_READ_DATA : 0x12,
  //SAHARA_RESET_STATE_MACHINE_ID : 0x13
}

export const sahara_mode_t = {
  SAHARA_MODE_IMAGE_TX_PENDING : 0x0,
  //SAHARA_MODE_IMAGE_TX_COMPLETE = 0x1,
  //SAHARA_MODE_MEMORY_DEBUG = 0x2,
  SAHARA_MODE_COMMAND : 0x3
}

export class CommandHandler {
  pkt_cmd_hdr(data) {
    if (data.length < 2*4) {
      console.error("DataError!")
      process.exit(1)
    }
    let st = new structHelper_io(data);
    return { cmd : st.dword(0), len : st.dword(4) }
  }

  pkt_hello_req(data) {
    if (data.length < 0xC * 0x4){
      console.error("DataError!")
      process.exit(1)
    }
    let st = new structHelper_io(data);
    return {
      cmd : st.dword(0),
      len : st.dword(4),
      version : st.dword(8),
      version_supported : st.dword(12),
      cmd_packet_length : st.dword(16),
      mode : st.dword(20),
      reserved1 : st.dword(24),
      reserved2 : st.dword(28),
      reserved3 : st.dword(32),
      reserved4 : st.dword(36),
      reserved5 : st.dword(40),
      reserved6 : st.dword(44),
    }
  }
  pkt_image_end(data) {
    if (data.length<0x4 * 0x4){
      console.error("ERROR");
      process.exit(1);
    }
    let st = new structHelper_io(data);
    return {
      cmd : st.dword(0),
      len : st.dword(4),
      image_id : st.dword(8),
      image_tx_status : st.dword(12),
    }
  }

  pkt_done(data) {
    if (data.length <0x3 * 4) {
      console.error("DataError");
      process.exit(1);
    }
    let st = new structHelper_io(data);
    return {
      cmd : st.dword(0),
      len : st.dword(4),
      image_tx_status : st.dword(8)
    }
  }

  pkt_read_data_64(data) {
    if (data.length <0x8 + 0x3 * 0x8) {
      console.error("DataError")
      process.exit(1)
    }
    let st = new structHelper_io(data)
    return {
      cmd : st.dword(0),
      len : st.dword(4),
      image_id : st.qword(8),
      data_offset : st.qword(16),
      data_len : st.qword(24),
    }
  }
  
  pkt_execute_rsp_cmd(data) {
    if (data.length <0x4 * 0x4) {
      console.error("DataError");
      process.exit(1);
    }
    let st = new structHelper_io(data)
    return {
        cmd : st.dword(0),
        len : st.dword(4),
        client_cmd : st.dword(8),
        data_len : st.dword(12),
    }
  }
}
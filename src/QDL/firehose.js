import { xmlParser } from "./xmlParser"
import { concatUint8Array, containsBytes, compareStringToBytes, sleep } from "./utils"

class cfg {

  constructor() {
    this.TargetName = "";
    this.Version = "";
    this.ZLPAwareHost = 1;
    this.SkipStorageInit = 0;
    this.SkipWrite = 0;
    this.MaxPayloadSizeToTargetInBytes = 1048576;
    this.MaxPayloadSizeFromTargetInBytes = 8192;
    this.MaxXMLSizeInBytes = 4096;
    this.bit64 = true;
    this.total_blocks = 0;
    this.num_physical = 0;
    this.block_size = 0;
    this.SECTOR_SIZE_IN_BYTES = 0;
    this.MemoryName = "UFS";
    this.prod_name = "Unknown";
    this.maxlun = 99;
  }
}

export class Firehose {
  cdc;
  //xml;
  cfg

  constructor(cdc) {
    this.cdc = cdc;
    this.xml = new xmlParser();
    this.cfg = new cfg();
  }

  async configure(lvl) {
    if (this.cfg.SECTOR_SIZE_IN_BYTES == 0)
      this.cfg.SECTOR_SIZE_IN_BYTES = 4096
    let connectCmd = `<?xml version=\"1.0\" encoding=\"UTF-8\" ?><data>` +
              `<configure MemoryName=\"${this.cfg.MemoryName}\" ` +
              `Verbose=\"0\" ` +
              `AlwaysValidate=\"0\" ` +
              `MaxDigestTableSizeInBytes=\"2048\" ` +
              `MaxPayloadSizeToTargetInBytes=\"${this.cfg.MaxPayloadSizeToTargetInBytes}\" ` +
              `ZLPAwareHost=\"${this.cfg.ZLPAwareHost}\" ` +
              `SkipStorageInit=\"${this.cfg.SkipStorageInit}\" ` +
              `SkipWrite=\"${this.cfg.SkipWrite}\"/>` +
              `</data>`

    // TODO: Transfer connectCmd to Uint8Array
    //let rsp = await this.xmlSend(connectCmd, false);
    //return true;
    let rsp = await this.xmlSend(connectCmd, false);
    if (rsp === null || !rsp.resp) {
      if (rsp.error == "") {
        return await this.configure(lvl+1);
      }
    } else {
      console.log("in here")
      await this.parseStorage();
      this.getLuns();
      return true;
    }
  }


  getLuns() {
    let luns = [];
    for (let i; i < this.cfg.maxlun; i++)
      luns.push(i);
    return luns;
  }


  async parseStorage() {
    const storageInfo = await this.getStorageInfo();
    console.log("storageInfo:", storageInfo);
    if (storageInfo === null || storageInfo.resp && storageInfo.data.length === 0)
      return false;
    const info = storageInfo.data;
    console.log("info in parseStorage:", info);
    if (info.hasOwnProperty("UFS Inquiry Command Output")) {
      console.log("IN UFS Inquiry Command Output ")
      this.cfg.prod_name = info["UFS Inquiry Command Output"];
    }
    if (info.hasOwnProperty("UFS Erase Block Size")) {
      console.log("UFS Erase Block Size")
      this.cfg.block_size = parseInt(info["UFS Erase Block Size"]);
      this.cfg.MemoryName = "UFS";
      this.cfg.SECTOR_SIZE_IN_BYTES = 4096;
    }
    if (info.hasOwnProperty("UFS Total Active LU")) {
      console.log("UFS Total Active LU")
      this.cfg.maxlun = parseInt(info["UFS Total Active LU"]);
    }
    if (info.hasOwnProperty("SECTOR_SIZE_IN_BYTES")) {
      console.log("SECTOR_SIZE_IN_BYTES")
      this.cfg.SECTOR_SIZE_IN_BYTES = parseInt(info["SECTOR_SIZE_IN_BYTES"]);
    }
    if (info.hasOwnProperty("num_physical_partitions")) {
      console.log("num_physical_partitions")
      this.cfg.num_physical = parseInt(info["num_physical_partitions"])
    }
    return true;
  }


  async getStorageInfo() {
    const data = "<?xml version=\"1.0\" ?><data><getstorageinfo physical_partition_number=\"0\"/></data>";
    let val = await this.xmlSend(data);
    console.log("val in getStorageInfo():", val)
    if (containsBytes("", val.data) && val.log.length == 0 && val.resp)
      return null;
    if (val.resp) {
      if (val.log !== null) {
        console.log("get val.log() !== null")
        let res = {};
        let v;
        for (const value of val.log) {
          v = value.split("=");
          if (v.length > 1) {
            res[v[0]] = v[1];
          } else {
            if (!value.includes("\"storage_info\"")) {
              v = value.split(":");
              if (v.length > 1)
                res[v[0]] = v[1].trimStart();
            }
          }
        }
        return { resp: val.resp, data : res};
      }
      return { resp : val.resp, data : val.data};
    } else {
      if (!val.error !== null && !val.error !== "") {
        console.error("failed to open SDCC device");
      }
      return null;
    }
  }


  async xmlSend(data, wait=true) {
    let dataToSend = new TextEncoder().encode(data).slice(0, this.cfg.MaxXMLSizeInBytes);
    await this.cdc?._usbWrite(dataToSend, null, wait);
    let rData = new Uint8Array(); // response data in bytes
    let counter = 0;
    let timeout = 0;
    while (!(containsBytes("<response value", rData))) {
      try {
        let tmp = await this.cdc?._usbRead();
        if (compareStringToBytes("", tmp)) {
          counter += 1;
          await sleep(50);
          if (counter > timeout)
            break;
        }
        rData = concatUint8Array([rData, tmp]);
      } catch (error) {
        console.error(error);
      }
    }
    try {
      const resp = this.xml.getReponse(rData); // input is Uint8Array
      const status = this.getStatus(resp);
      if (status !== null) {
        if (containsBytes("log value=", rData)) {
          let log = this.xml.getLog(rData);
          return { resp : status, data : rData, log : log, error : "" }; // TODO: getLog()
        }
        return { resp : status, data : rData, log : [] , error : ""};
      }
    } catch (error) {
      console.error(error);
    }
    return {resp : true, data : rData, log : [], error : ""};
  }

  async cmdReset() {
    let data = "<?xml version=\"1.0\" ?><data><power value=\"reset\"/></data>";
    let val = await this.xmlSend(data);
    if (val.resp) {
      console.log("Reset succeeded");
      return true;
    } else {
      console.error("Reset failed");
      return false;
    }
  }

  getStatus(resp) {
    if (resp.hasOwnProperty("value")) {
      let value = resp["value"];
      if (value == "ACK" || value == "true" ) {
        return true;
      } else {
        return false;
      }
    }
    return true;
  }
}
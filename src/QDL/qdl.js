import { usbClass } from "./usblib"
import { Sahara } from  "./sahara"


export class qdlDevice {
  cdc;
  sahara;

  constructor() {
    this.cdc = new usbClass();
    this.sahara = new Sahara(this.cdc);
  }

  //async doconnect() {
  //  while (!this.cdc.connected){
  //    await this.cdc?.connect();
  //    if (this.cdc.connected){
  //      console.log("Device detected");
  //      try {
  //        let resp = await this.sahara?.connect();
  //        console.log("finish connecting sahara");
  //        if (resp.hasOwnProperty("mode")){
  //          let mode = resp["mode"];
  //          console.log("Mode detected:", mode);
  //          return resp;
  //        }
  //      } catch (error) {
  //        console.error(error);
  //        process.exit(1);
  //      }
  //    }
  //  }
  //  return {"mode" : "error"};
  //}

  async doconnect() {
    while (!this.cdc.connected){
      await this.cdc?.connect();
      if (this.cdc.connected) {
        try {
          await this.cdc.runCommand(`getvar:all`);
          console.log("finish running command");
          await this.cdc._readResponse();
        } catch (error) {
          console.error(error);
        }
      }
    }
  }
}
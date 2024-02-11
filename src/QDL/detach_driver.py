import array
import time
import sys

import usb.core
import usb.util
import usb.backend.libusb0
import usb.backend.libusb1
from ctypes import c_void_p, c_int

class usb_class:
  def __init__(self, portconfig=None, serial_number=None):
    # Deviceclass
    self.portconfig = portconfig
    #self.configuration = None
    self.device = None
    #self.devclass = -1

    #self.EP_IN = None
    #self.EP_OUT = None
    #self.is_serial = False
    #self.buffer = array.array('B', [0]) * 1048576
    if sys.platform.startswith('freebsd') or sys.platform.startswith('linux') or sys.platform.startswith('darwin'):
      self.backend = usb.backend.libusb1.get_backend(find_library=lambda x: "libusb-1.0.so")
    else:
      print("Only support Unix-based machine")
      sys.exit(1)
    if self.backend is not None:
      try:
        self.backend.lib.libusb_set_option.argtypes = [c_void_p, c_int]
        self.backend.lib.libusb_set_option(self.backend.ctx, 1)
      except:
        self.backend = None

  def connect(self, EP_IN=-1, EP_OUT=-1):
    if self.connected:
      self.close()
      self.connected = False
    #self.device = None
    #self.EP_OUT = None
    #self.EP_IN = None
    devices = usb.core.find(find_all=True, backend=self.backend)
    for d in devices:
      for usbid in self.portconfig:
        if d.idProduct == usbid[1] and d.idVendor == usbid[0]:
          self.device = d
          self.vid = d.idVendor
          self.pid = d.idProduct
          #self.interface = usbid[2]
          break
      if self.device is not None:
        break

    if self.device is None:
      print("Couldn't detect the device. Is it connected ?")
      return False

    try:
      self.configuration = self.device.get_active_configuration()
    except usb.core.USBError as e:
      if e.strerror == "Configuration not set":
        self.device.set_configuration()
        self.configuration = self.device.get_active_configuration()
      if e.errno == 13:
        self.backend = usb.backend.libusb0.get_backend()
        self.device = usb.core.find(idVendor=self.vid, idProduct=self.pid, backend=self.backend)
    #for itf in self.configuration:
    #  if self.devclass == -1:
    #    print("GET IN DEVCLass = -1")
    #    self.devclass = 0xFF
    #  if itf.bInterfaceClass == self.devclass:
    #    if self.interface == -1 or self.interface == itf.bInterfaceNumber:
    #      self.interface = itf
    #      self.EP_OUT = EP_OUT
    #      self.EP_IN = EP_IN
    #      for ep in itf:
    #        edir = usb.util.endpoint_direction(ep.bEndpointAddress)
    #        if (edir == usb.util.ENDPOINT_OUT and EP_OUT == -1) or ep.bEndpointAddress == (EP_OUT & 0xF):
    #          print("++++++++++++GOES IN EP_OUT SET")
    #          self.EP_OUT = ep
    #        elif (edir == usb.util.ENDPOINT_IN and EP_IN == -1) or ep.bEndpointAddress == (EP_OUT & 0xF):
    #          print("++++++++++++GOES IN EP_IN SET")
    #          self.EP_IN = ep
    #      break

    #if self.EP_OUT is not None and self.EP_IN is not None:
    try:
      if self.device.is_kernel_driver_active(0):
        print("Detaching kernel driver")
        self.device.detach_kernel_driver(0)
    except Exception as err:
      print("No kernel driver supported: " + str(err))
    return False

if __name__ == "__main__":
  cdc = usb_class([[0x05c6, 0x9008, -1]])
  cdc.connect()
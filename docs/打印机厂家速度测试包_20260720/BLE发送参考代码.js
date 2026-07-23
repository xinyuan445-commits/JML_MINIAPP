function writeBleData(options) {
  const packetSize = 100;
  const value = options.value;
  const byteLength = value.byteLength;
  if (!byteLength) {
    options.success && options.success();
    return;
  }

  wx.writeBLECharacteristicValue({
    deviceId: options.deviceId,
    serviceId: options.serviceId,
    characteristicId: options.characteristicId,
    value: value.slice(0, Math.min(packetSize, byteLength)),
    success() {
      if (byteLength <= packetSize) {
        options.success && options.success();
        return;
      }
      writeBleData({
        ...options,
        value: value.slice(packetSize)
      });
    },
    fail(error) {
      options.fail && options.fail(error);
    }
  });
}

module.exports = {
  writeBleData
};


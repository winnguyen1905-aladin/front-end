async function getMic2(): Promise<string | undefined> {
  await navigator.mediaDevices.getUserMedia({ audio: {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    backgroundBlur: true,
  }
 });
  const devices: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();
  const audioDevices: MediaDeviceInfo[] = devices.filter(device => device.kind === 'audioinput');
  let webCamMicId: string | undefined;
  
  audioDevices.forEach(device => {
    if (device.label.includes("Web")) {
      webCamMicId = device.deviceId;
    }
  });
  
  return webCamMicId;
}

export default getMic2;

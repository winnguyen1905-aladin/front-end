interface UIButtons {
  enableFeed: HTMLButtonElement | null;
  sendFeed: HTMLButtonElement | null;
  hangUp: HTMLButtonElement | null;
  roomInfo: HTMLElement | null;
  control: HTMLElement | null;
  joinRoom: HTMLButtonElement | null;
  localMediaLeft: HTMLVideoElement | null;
  localMediaRight: HTMLVideoElement | null;
  remoteMediaMain: HTMLElement | null;
  muteBtn: HTMLButtonElement | null;
}

const enableFeed = document.getElementById('enable-feed') as HTMLButtonElement | null;
const sendFeed = document.getElementById('send-feed') as HTMLButtonElement | null;
const hangUp = document.getElementById('hang-up') as HTMLButtonElement | null;
const roomInfo = document.getElementById('room-info');
const control = document.getElementById('control-buttons');
const joinRoom = document.getElementById('join-room') as HTMLButtonElement | null;
const remoteMediaMain = document.getElementById('remote-media');
const localMediaLeft = document.getElementById('local-video-left') as HTMLVideoElement | null;
const localMediaRight = document.getElementById('local-video-right') as HTMLVideoElement | null;
const muteBtn = document.getElementById('mute') as HTMLButtonElement | null;

const buttons: UIButtons = {
  enableFeed,
  sendFeed,
  hangUp,
  roomInfo,
  control,
  joinRoom,
  localMediaLeft,
  localMediaRight,
  remoteMediaMain,
  muteBtn,
};

export default buttons;

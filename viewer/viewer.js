/**
 * DesktopLens Chrome Viewer
 *
 * WebSocket binary client + Canvas 2D 渲染
 * 支援 Full Frame 和 Diff Frame (dirty block patch)
 */
(function () {
  'use strict';

  // Protocol constants
  const MAGIC = 0xdc01;
  const FRAME_TYPE_FULL = 0x01;
  const FRAME_TYPE_DIFF = 0x02;

  // DOM elements
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const fpsEl = document.getElementById('fps');
  const latencyEl = document.getElementById('latency');
  const resolutionEl = document.getElementById('resolution');
  const framesEl = document.getElementById('frames');

  // State
  let ws = null;
  let frameCount = 0;
  let lastFrameTime = 0;
  let fpsHistory = [];

  // Extract session ID from URL path: /viewer/{sessionId}
  const pathParts = window.location.pathname.split('/');
  const sessionId = pathParts[pathParts.length - 1] || '';

  function connect() {
    const wsUrl = 'ws://' + window.location.host + '/stream/' + sessionId;
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = function () {
      statusEl.textContent = 'Connected';
      statusEl.className = 'status connected';
    };

    ws.onclose = function () {
      statusEl.textContent = 'Disconnected';
      statusEl.className = 'status disconnected';
      // Reconnect after delay
      setTimeout(connect, 2000);
    };

    ws.onerror = function () {
      statusEl.textContent = 'Error';
      statusEl.className = 'status disconnected';
    };

    ws.onmessage = function (event) {
      handleFrame(new DataView(event.data));
    };
  }

  function handleFrame(view) {
    if (view.byteLength < 11) return;

    var magic = view.getUint16(0, false);
    if (magic !== MAGIC) return;

    var type = view.getUint8(2);
    var timestamp = view.getUint32(3, false);
    var width = view.getUint16(7, false);
    var height = view.getUint16(9, false);

    // Update canvas size if needed
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      resolutionEl.textContent = width + '×' + height;
    }

    if (type === FRAME_TYPE_FULL) {
      handleFullFrame(view, 11);
    } else if (type === FRAME_TYPE_DIFF) {
      handleDiffFrame(view, 11, width, height);
    }

    // Update stats
    frameCount++;
    framesEl.textContent = 'Frames: ' + frameCount;

    var now = performance.now();
    if (lastFrameTime > 0) {
      var delta = now - lastFrameTime;
      fpsHistory.push(1000 / delta);
      if (fpsHistory.length > 30) fpsHistory.shift();
      var avgFps = fpsHistory.reduce(function (a, b) { return a + b; }, 0) / fpsHistory.length;
      fpsEl.textContent = 'FPS: ' + avgFps.toFixed(1);
    }
    lastFrameTime = now;
    latencyEl.textContent = 'Latency: ' + ((Date.now() & 0xffffffff) - timestamp) + 'ms';
  }

  function handleFullFrame(view, offset) {
    if (view.byteLength < offset + 4) return;
    var dataLen = view.getUint32(offset, false);
    offset += 4;
    if (view.byteLength < offset + dataLen) return;

    var blob = new Blob([new Uint8Array(view.buffer, offset, dataLen)]);
    var img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(blob);
  }

  function handleDiffFrame(view, offset, frameWidth, frameHeight) {
    if (view.byteLength < offset + 4) return;
    var gridCols = view.getUint8(offset); offset += 1;
    var gridRows = view.getUint8(offset); offset += 1;
    var dirtyCount = view.getUint16(offset, false); offset += 2;

    var blockW = Math.floor(frameWidth / gridCols);
    var blockH = Math.floor(frameHeight / gridRows);

    for (var i = 0; i < dirtyCount; i++) {
      if (view.byteLength < offset + 6) return;
      var col = view.getUint8(offset); offset += 1;
      var row = view.getUint8(offset); offset += 1;
      var blockDataLen = view.getUint32(offset, false); offset += 4;
      if (view.byteLength < offset + blockDataLen) return;

      var bx = col * blockW;
      var by = row * blockH;

      (function (x, y) {
        var blob = new Blob([new Uint8Array(view.buffer, offset, blockDataLen)]);
        var img = new Image();
        img.onload = function () {
          ctx.drawImage(img, x, y);
          URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(blob);
      })(bx, by);

      offset += blockDataLen;
    }
  }

  // Start connection
  if (sessionId) {
    connect();
  } else {
    statusEl.textContent = 'No Session ID';
  }
})();

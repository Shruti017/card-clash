/* =========================================================
   socket.js - establish the Socket.IO connection.
   Connects to same origin by default. To run multiplayer on
   a deployed front-end, set window.SOCKET_URL to your
   external Socket.IO server (e.g. on Render/Railway) BEFORE
   this script loads, e.g.:
     <script>window.SOCKET_URL = "https://my-server.onrender.com";</script>
   ========================================================= */
window.CCSocket = io(window.SOCKET_URL || undefined);

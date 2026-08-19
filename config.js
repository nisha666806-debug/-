/* =========================================================================
   config.js — танзимоти сервер.
   Дар production ин қиматҳоро тавассути environment variables диҳед,
   на дар код нависед (масалан: ADMIN_PASSWORD=... node server.js)
   ========================================================================= */
module.exports = {
  PORT: process.env.PORT || 4000,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123",
  MIN_ORDER_SUM: 800,
};

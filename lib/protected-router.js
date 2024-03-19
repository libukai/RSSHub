const Router = require('@koa/router');
const router = new Router();

// const auth = require('koa-basic-auth');
// // 修改为自己的用户名和密码
// const config = { name: 'admin', pass: 'free' };
// router.use('/(.*)', auth(config));

router.get('/nytimes/:channel?', require('./private/nytimes/channel'));
router.get('/voa', require('./private/voa'));
router.get('/nikkei', require('./private/nikkei'));
router.get('/dw', require('./private/dw'));
router.get('/chosun', require('./private/chosun'));
router.get('/hket', require('./private/hket'));
router.get('/udn', require('./private/udn'));
router.get('/sputnik', require('./private/sputnik'));
router.get('/tvb', require('./private/tvb'));
router.get('/cna/web/:id?', require('./private/cna/web'));

module.exports = router;

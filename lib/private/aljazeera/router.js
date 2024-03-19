module.exports = function (router) {
    router.get(/([\w/-]+)?/, require('lib/private/aljazeera/index'));
};

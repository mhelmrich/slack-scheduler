var express = require('express');
var bodyParser = require('body-parser');
var router = express.Router();

router.get("/oauthcallback", function(req, res)
{
  console.log("req.body is: ", req.body);
});


module.exports = router;

  return router;
}

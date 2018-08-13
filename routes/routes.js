var express = require('express');
var bodyParser = require('body-parser');
var router = express.Router();

router.get("/", function(req, res, next)
{
  console.log("Tdfijsfojds");
});


router.get("/oauthcallback", function(req, res)
{
  console.log(req.body);
});


router.post("/oauthcallback", function(req, res)
{
  console.log("req.body is: ", req.body);
});


module.exports = router;

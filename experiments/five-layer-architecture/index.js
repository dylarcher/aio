const APIGateway = require('./layer-2-api-gateway/api-gateway');

const gateway = new APIGateway();

const port = process.env.PORT || 3000;

gateway.app.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
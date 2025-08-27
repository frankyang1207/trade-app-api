const app = require("./index");
const port = process.env.REACT_APP_PORT || 9000;

app.listen(port, () => console.log(`listening on port: ${port}`));
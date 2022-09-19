console.log("Starting Server...")


const express = require('express'),
  app = express()

const logger = (req,res,next) => {
  console.log('url: ', req.url)
  next()
}

app.use(logger)

app.get('/', (req, res) => res.send('Hello World'))

app.listen(process.env.PORT || 3000)
// Importing https module
const https = require('https');
  
// Setting the configuration for
// the request
const options = {
    hostname: 'maps.googleapis.com',
    path: '/maps/api/geocode/json?address=24%20Sussy%20Drive%20Ottawa%20ON&key=AIzaSyBns3Cd20dcOsq-JPFkAIRkHsZ_-wAULeU',
    method: 'GET'
};
    
// Sending the request
const req = https.request(options, (res) => {
    let data = ''
     
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    // Ending the response 
    res.on('end', () => {
        data = JSON.parse(data)
        console.log('Body:', data)
        console.log(data.results[0].geometry.location)
    });
       
}).on("error", (err) => {
    console.log("Error: ", err)
}).end()
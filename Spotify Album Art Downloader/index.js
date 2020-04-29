/*
=-=-=-=-=-=-=-=-=-=-=-=-
Album Art Search
=-=-=-=-=-=-=-=-=-=-=-=-
Student ID: 23592773
Comment (Required):

=-=-=-=-=-=-=-=-=-=-=-=-
*/

const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const port = 3000;


const credentials = require('./auth/credentials.json');
const authentication_cache = './auth/authentication-res.json';

let base64data = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');
// console.log(`Basic ${base64data}`);

const connection = function connection_handler(req, res){
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);

	if(req.url === '/'){
		const root = fs.createReadStream('html/main.html');
		res.writeHead(200, {'Content-Type':'text/html'});
		root.pipe(res);
	} else if(req.url === '/favicon.ico'){
		const ico = fs.createReadStream('images/favicon.ico');
		res.writeHead(200,{'Content-Type':'image/x-icon'});
		ico.pipe(res);
	} else if(req.url === '/images/banner.jpg'){
		const img = fs.createReadStream('images/banner.jpg');
		res.writeHead(200,{'Content-Type':'image/jpeg'});
		img.pipe(res);
	} else if(req.url.startsWith('/album-art/')){
		let image_stream = fs.createReadStream(`.${req.url}`);
		image_stream.on('error', function(err){
			res.writeHead(404, {"Content-Type": "text/plain"});
			res.write("404 Not found");
			res.end();
		});
		image_stream.on('ready', function(){
			res.writeHead(200,{'Content-Type':'image/jpeg'});
			image_stream.pipe(res);
		});
	} else if(req.url.startsWith('/search')){
		
// let artist_stream = fs.createReadStream(`.${req.url}`);
// console.log(artist_stream);
		const authentication_res = url.parse(req.url,true);
		const queryData = authentication_res.query;
		let user_input = queryData.artist;
		
        const received_authentication = (authentication_res, user_input, auth_sent_time, res) => {
            authentication_res.setEncoding("utf8");
            let body = "";
            authentication_res.on("data", chunk => { body += chunk; });
            authentication_res.on("end", () => {
                let spotify_auth = JSON.parse(body);
                console.log(`Requesting Spotify Token: ${body}`);
                Object.defineProperty(spotify_auth, "expiration", { value: new Date(3600000 + auth_sent_time.getTime()) });
              
                create_access_token_cache(spotify_auth);
                create_search_req(spotify_auth, user_input, res);
            });
        };

        const create_access_token_cache = spotify_auth => {
            fs.writeFile(authentication_cache, JSON.stringify(spotify_auth), err => {
                if (err) throw err;
            });
        };

        const create_search_req = function (spotify_auth, user_input){
            const token_endpoint = "https://api.spotify.com/v1/search",
                access_token = spotify_auth.access_token,
                type = "album",
                q = user_input;
            const request = `${token_endpoint}?type=${type}&q=${q}&access_token=${access_token}`;
            
            const req = https.request(request, res => {
                console.log(`Searching for: ${q}...`);
                download_albums(res);
            });

            const download_albums = function(res) {
                let downloaded_images = 0, img_url_arr = [], body = "";
                console.log("Downloading Images To /album-art/ ...");
                res.setEncoding('utf8');
                res.on("error", err => { console.log(err); });
                res.on("data", chunk => { body += chunk; });
                res.on("end", () => {
                    let spotify_json_response = JSON.parse(body);
                    for (let i = 0; i < Object.keys(spotify_json_response.albums.items).length; i++) {
                        let url = spotify_json_response.albums.items[i].images[1].url; //used images[1] instead because the pictures are more appropriately sized
                        fs.access(`./album-art/${url.slice(url.lastIndexOf("/") + 1)}.jpg`, () => {
                            let image_req = https.get(url, image_res => {
                                console.log(`Fetching Image In: /album-art/${url.slice(url.lastIndexOf("/") + 1)}.jpg `);
                                let new_img = fs.createWriteStream(`./album-art/${url.slice(url.lastIndexOf("/") + 1)}.jpg`, { 'encoding': null });
                                image_res.pipe(new_img);
                                img_url_arr.push(`./album-art/${url.slice(url.lastIndexOf("/") + 1)}.jpg`);
                                new_img.on("finish", () => {
                                    downloaded_images++;
                                    if (downloaded_images === Object.keys(spotify_json_response.albums.items).length) {
                                        console.log("Downloading Complete");
                                        webpage_generation(img_url_arr);
                                    }
                                });
                            });
                            image_req.end();
                        }); 
                    } 
                }); 
            }; 
            req.end();
        }; 

		const post_data = querystring.stringify({
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            grant_type: 'client_credentials'
        });

        const options = {
            'method': 'POST',
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': post_data.length
            }
        };


		let cache_valid = false;

        if (fs.existsSync(authentication_cache)) {
            cached_auth = require(authentication_cache);
            if (new Date(cached_auth.expiration) > Date.now()) {
                cache_valid = true;
            }
            else {
                console.log("Token Expired");
            }
        }

        if (cache_valid) {
            console.log("The Authentication Cache ");
            create_search_req(cached_auth, user_input, res);
        }

        else {
            const token_endpoint = 'https://accounts.spotify.com/api/token';
            let auth_sent_time = new Date();
            let authentication_req = https.request(token_endpoint, options, authentication_res => {
                console.log("Receiving Authentication Request From Spotify...");
                received_authentication(authentication_res, user_input, auth_sent_time, res);
            });
            authentication_req.on('error', (err) => {
                console.log(err);
            });
            console.log("Requesting Token...");
            authentication_req.end(post_data);
        }
		const webpage_generation = img_url_arr => {
            console.log('Generating Webpage');
            let webpage = `<h1>Search Results For: ${user_input}</h1>`;
            const img_arr = img_url_arr.map((url) => {
                return `<img src="${url}">`
            });
            const imgs = img_arr.join();
            webpage += `<p>${imgs}</p>`;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write(webpage);
            res.end();
        };
		
	} else {
		res.writeHead(404)
			.end(); 
	}
};

const server = http.createServer(connection);
server.listen(port);
console.log(`Now Listening on Port ${port}`);
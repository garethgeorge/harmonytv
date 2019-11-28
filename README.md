# HarmonyTV

This is a cloud-first alternative to plex designed for large-scale deployments with potentially hundreds of concurrent streamers and with media libraries larger than can be stored on a single conventional server. Media is stored in S3 or Google Drive and is indexed by a centralized database. Multiple installations can share a single datastore and distribute load. 

HarmonyTV can be placed behind a load balancer or reverse proxy, some specific routing rules may be required however to support heavy load.

## Our Team of Awesome Developers

 - [Gareth George](https://github.com/garethgeorge)
 - [Dylan Pizzo](https://github.com/dylanpizzo)

# Deployment

 - step 1
```
git clone https://github.com/garethgeorge/harmonytv.git
cd harmonytv/harmonybackend/ && npm i && cd ../harmonyfrontend/ && npm i && cd ..
```
 - step 2: edit configuration files in 
```
harmonybackend/src/config.example.js -> harmonyfrontend/src/config.js
harmonyfrontend/src/config.example.js -> harmonyfrontend/src/config.js
```
 - step 3: start the development website
```
docker-compose -f docker-compose.dev.yml up 
```
 - or the production website after configuring SSL keys 
```
docker-compose up 
```

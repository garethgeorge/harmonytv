# HarmonyTV

This is an alternative to plex designed for large-scale deployments with potentially hundreds of concurrent streamers. 

HarmonyTV can be placed behind a load balancer or reverse proxy, some specific routing rules may be required however to support heavy load.

# Deployment

step 1
```
git clone https://github.com/garethgeorge/harmonytv.git
```
step 2: edit configuration files in 
```
harmonybackend/src/config.example.js -> harmonyfrontend/src/config.js
```
step 3: start harmonybackend on the host machine to configure google drive
```
cd harmonybackend && node bin/web.js 
```
follow the prompts to configure google drive

step 4: start the development website
```
docker-compose -f docker-compose.dev.yml up 
```
or the production website after configuring SSL keys 
```
docker-compose up 
```

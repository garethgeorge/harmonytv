# HarmonyTV

This is an alternative to plex designed for large-scale deployments with potentially hundreds of concurrent streamers. 

HarmonyTV can be placed behind a load balancer or reverse proxy, some specific routing rules may be required however to support heavy load.

## TODO
- authenticate users on sockets with https://www.npmjs.com/package/passport.socketio
- switch UI framework https://v2.grommet.io/
- refactor encryption into shared code that sits outside the data stores, remove encryption by default instead storing plaintext first and then applying strong encryption if enabled in the settings
- implement a localdisk storage provider
- implement per-library provider configuration i.e. multiple storage backend types can be mounted at once
- ~~fix the videoplayer following tutorial here: https://github.com/amit08255/shaka-player-react-with-ui-config/blob/master/with-default-ui/src/components/VideoPlayer.js~~
- wrap axios to check for errors in JSON responses and display them to the user as warnings
- setup HTTPS so that chrome casting works properly


# DONE 
- ~~implement synchronized video playback~~ DONE
- ~~implement database migrations~~ DONE
- ~~implement iOS/mobile fallback stream~~ ABANDONED (todo: return to this idea)
- migrate model into submodules i.e. model.user, model.media, etc 
- ~~user accounts and password authentication~~ DONE
- ~~playback history for each user~~
- ~~resume playback option for previously played videos~~
- ~~use a different encryption key for each file, makes application much more secure~~ DONE

# Tech Stack Upgrades
- look into MobX https://mobx.js.org/intro/concepts.html as a state manager (possibly simpler/easier alternative to redux) for React app

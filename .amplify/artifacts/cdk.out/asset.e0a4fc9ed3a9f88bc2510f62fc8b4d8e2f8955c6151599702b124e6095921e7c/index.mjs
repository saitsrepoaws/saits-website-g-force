/** * Reads SSM environment context from a known Amplify environment variable, * fetches values from SSM and places those values in the corresponding environment variables */export const internalAmplifyFunctionResolveSsmParams = async (client) => {    const envPathObject = JSON.parse(process.env.AMPLIFY_SSM_ENV_CONFIG ?? '{}');    const paths = Object.values(envPathObject).map((paths) => paths.path);    if (paths.length === 0) {        return;    }    let actualSsmClient;    if (client) {        actualSsmClient = client;    }    else {        const ssmSdk = await import('@aws-sdk/client-ssm');        actualSsmClient = new ssmSdk.SSM();    }    const chunkArray = (array, chunkSize) => {        const chunks = [];        for (let i = 0; i < array.length; i += chunkSize) {            chunks.push(array.slice(i, i + chunkSize));        }        return chunks;    };    const resolveSecrets = async (paths) => {        const response = (await Promise.all(chunkArray(paths, 10).map(async (chunkedPaths) => await actualSsmClient.getParameters({            Names: chunkedPaths,            WithDecryption: true,        })))).reduce((accumulator, res) => {            accumulator.Parameters?.push(...(res.Parameters ?? []));            accumulator.InvalidParameters?.push(...(res.InvalidParameters ?? []));            return accumulator;        }, {            Parameters: [],            InvalidParameters: [],        });        if (response.Parameters && response.Parameters.length > 0) {            for (const parameter of response.Parameters) {                if (parameter.Name) {                    const envKey = Object.keys(envPathObject).find((key) => envPathObject[key].sharedPath === parameter.Name ||                        envPathObject[key].path === parameter.Name);                    if (envKey) {                        process.env[envKey] = parameter.Value;                    }                }            }        }        return response;    };    const response = await resolveSecrets(paths);    const sharedPaths = (response?.InvalidParameters || [])        .map((invalidParam) => Object.values(envPathObject).find((paths) => paths.path === invalidParam)?.sharedPath)        .filter((sharedParam) => !!sharedParam);     if (sharedPaths.length > 0) {        await resolveSecrets(sharedPaths);    }};await internalAmplifyFunctionResolveSsmParams();const SSM_PARAMETER_REFRESH_MS = 1000 * 60;setInterval(async () => {    try {        await internalAmplifyFunctionResolveSsmParams();    }    catch (error) {        try {                        console.debug(error);                    }        catch {                    }    }}, SSM_PARAMETER_REFRESH_MS);export {};
import{createRequire as g}from"node:module";import P from"node:path";import h from"node:url";global.require=g(import.meta.url);global.__filename=h.fileURLToPath(import.meta.url);global.__dirname=P.dirname(__filename);import I from"https";var T=process.env.APPSYNC_ENDPOINT||"",N=process.env.APPSYNC_API_KEY||"";async function k(c,p={}){let r=new URL(T),i=JSON.stringify({query:c,variables:p});return new Promise((s,y)=>{let u={hostname:r.hostname,path:r.pathname,method:"POST",headers:{"Content-Type":"application/json","x-api-key":N,"Content-Length":Buffer.byteLength(i)}},e=I.request(u,a=>{let n="";a.on("data",t=>{n+=t}),a.on("end",()=>{try{s(JSON.parse(n))}catch(t){y(t)}})});e.on("error",y),e.write(i),e.end()})}var A=async c=>{console.log("\u{1F4E5} LOAD Command Handler invoked:",JSON.stringify(c,null,2));let{playerId:p,playlistId:r,timestamp:i}=c;if(!r)return{success:!1,error:"Missing playlistId"};try{let u=(await k(`
      query GetPlaylist($id: ID!) {
        getPlaylist(id: $id) {
          id
          name
          tracks
        }
      }
    `,{id:r})).data?.getPlaylist;if(!u)return{success:!1,error:"Playlist not found"};let e=JSON.parse(u.tracks||"[]");if(e.length===0)return{success:!1,error:"Playlist is empty"};let a=new Date(i||Date.now()),n=a.getHours()*3600+a.getMinutes()*60+a.getSeconds(),t=0,o=0;for(let l=0;l<e.length;l++){let f=e[l].duration||180;if(n>=t&&n<t+f){o=l;break}if(t+=f,l===e.length-1&&n>=t){o=0;break}}let m=e[o];console.log("\u{1F3AF} Selected track index:",o),console.log("\u{1F3B5} Track ID:",m.trackId);let d=(await k(`
      query GetTrack($id: ID!) {
        getTrack(id: $id) {
          id
          title
          artist
          album
          fileUrl
          coverArtUrl
          waveformUrl
          duration
          bpm
          key
          energy
          genre
          year
          label
        }
      }
    `,{id:m.trackId})).data?.getTrack;return d?(console.log("\u2705 Track found:",d.title,"by",d.artist),{success:!0,playlistId:r,trackIndex:o,track:d}):{success:!1,error:"Track not found"}}catch(s){return console.error("\u274C Error:",s),{success:!1,error:s.message||"Unknown error"}}};export{A as handler};
//# sourceMappingURL=index.mjs.map

import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import logger from './logger';
import express, { Application, json, Request, Response, urlencoded } from 'express';
import { Client } from 'linkedin-private-api';

const environment = process.env.NODE_ENV || 'dev';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${environment}`) });

try {
  const mainApp: Application = express();

  // Middleware
  mainApp.use(json());
  mainApp.use(urlencoded({ extended: false }));
  mainApp.use(express.static('public', { maxAge: '1d' }));

  // Health check
  mainApp.get('/', (req: Request, res: Response) => {
    return res.json({
      status: 'running!',
    });
  });

  mainApp.get('/linkedin-test/:companyName?', async (req: Request, res: Response) => {
    const { companyName } = req.params;
    if (!companyName) {
      return res.status(400).json({
        error: 'companyName is required. Example: /linkedin-test/Strike',
      });
    }

    // This client uses the https://github.com/nickls/linkedin-unofficial-api internally
    const client = new Client();
    await client.login.userPass({ username: 'dariomac@gmail.com', password: 'the-real-pwd' });

    const companySearchResult = client.search.searchCompanies({ keywords: companyName });
    const company = (await companySearchResult.fetch()).map(c => c.company)[0]

    // this is the same as searching for "Strike" in the search bar, and then clicking on People filter
    // const connInCompany = client.search.searchOwnConnections({ keywords: 'Strike' });
    const connInCompany = client.search.searchOwnConnections({ filters: { currentCompany: company.companyId } }); // currently is working on that company
    
    // TODO: I'm not handling the pagination here... but it should be done
    const people = await connInCompany.fetch();

    const result = { 
      people: people.map(p => {
        if (p.memberDistance.value === 'DISTANCE_1' ) { //DISTANCE_2 is 2nd degree connection
          return {
            firstname: p.profile.firstName,
            lastname: p.profile.lastName,
            url: `https://www.linkedin.com/in/${p.profile.publicIdentifier}/`,
          }
        }
        return null;
      }),
    };

    return res.json({
      result,
    });
  });

  // Init Express
  const PORT: string | number = process.env.PORT || 3000;
  mainApp.listen(
    PORT,
    () => console.log(`Express started on port ${PORT}`), // eslint-disable-line
  );

  // just in case we want to test something without using express
  http
    .createServer(function (req, res) {
      res.writeHead(200, {
        /* eslint-disable @typescript-eslint/naming-convention */
        'Content-Type': 'text/html',
        /* eslint-enable */
      });
      res.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <script>
            function updateCurrent() {
              document.querySelector('#time').innerHTML = (new Date()).toISOString();
            }
            setInterval(() => {
              location.reload();
              updateCurrent();
            }, 60000);
          </script>
        </head>
        <body>
          <h1>This is a title</h1>
          <p>Some content here</p>

          <script>updateCurrent();</script>
        </body>
      </html>`);
      res.end();
    })
    .listen(5001);
  // eslint-disable-next-line no-console
  console.log('Custom server is started on port 5001');
} catch (err) {
  logger.error(err);
}

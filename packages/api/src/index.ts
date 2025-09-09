import 'dotenv/config';

// TODO: This seems strange, not sure what is going on with these tsconfig settings
// I have no idea why it requires .js for regular imports and .ts for type imports
// But I don't like it, it's fine for now but need to figure out what in the
// ecmascript is going on.
import { startServer } from './serve.js';

startServer();

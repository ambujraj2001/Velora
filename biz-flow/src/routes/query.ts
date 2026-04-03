import { Router } from 'express';
import { validate } from '../middleware/validate';
import { csvQuerySchema } from '../schemas';
import { handleCsvQuery } from '../controllers/csvQueryController';

const router = Router();

router.post('/csv', validate(csvQuerySchema), handleCsvQuery);

export default router;

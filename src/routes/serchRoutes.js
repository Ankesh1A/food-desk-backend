// routes/searchRoutes.js
import express from 'express';
import {
    globalSearch,
    getSearchSuggestions,
    getTrendingSearches,
    getSearchFilters
} from '../controllers/serchController.js';

const router = express.Router();

// All routes are public
router.get('/', globalSearch); // Global search
router.get('/suggestions', getSearchSuggestions); // Autocomplete suggestions
router.get('/trending', getTrendingSearches); // Trending searches
router.get('/filters', getSearchFilters); // Available filters

export default router;
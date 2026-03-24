import express from 'express';
import {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    applyPromoCode,
    removePromoCode,
    getCartCount
} from '../controllers/cartController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCart);
router.get('/count', getCartCount);
router.post('/add', addToCart);
router.put('/update/:itemId', updateCartItem);
router.delete('/remove/:itemId', removeFromCart);
router.delete('/clear', clearCart);
router.post('/apply-promo', applyPromoCode);
router.delete('/remove-promo', removePromoCode);

export default router;
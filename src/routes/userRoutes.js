import express from 'express';
import {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    getProfile,
    updateProfile,
    updateAvatar,
    removeAvatar,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getUserStats,
    deactivateAccount
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadSingle } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', uploadSingle('avatar'), updateProfile);
router.put('/profile/avatar', uploadSingle('avatar'), updateAvatar);
router.delete('/profile/avatar', removeAvatar);

// Stats & Account
router.get('/stats', getUserStats);
router.put('/deactivate', deactivateAccount);

// Address routes
router.post('/address', addAddress);
router.put('/address/:addressId', updateAddress);
router.delete('/address/:addressId', deleteAddress);
router.put('/address/:addressId/default', setDefaultAddress);


router.get('/', authorize('admin'), getUsers);
router.post('/', authorize('admin'), uploadSingle('avatar'), createUser);  
router.get('/:id', authorize('admin'), getUser);
router.put('/:id', authorize('admin'), uploadSingle('avatar'), updateUser); 
router.delete('/:id', authorize('admin'), deleteUser);

export default router;
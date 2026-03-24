import Order from '../models/Order.js';
import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import Food from '../models/Food.js';
import Review from '../models/Review.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

// @desc    Get admin dashboard stats
// @route   GET /api/dashboard/admin
// @access  Private/Admin
export const getAdminDashboard = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // Get counts
    const [
        totalUsers,
        totalRestaurants,
        totalOrders,
        totalFoods,
        todayOrders,
        thisMonthOrders,
        lastMonthOrders,
        pendingOrders,
        activeRestaurants,
        newUsersToday,
        newUsersThisMonth
    ] = await Promise.all([
        User.countDocuments(),
        Restaurant.countDocuments(),
        Order.countDocuments(),
        Food.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: today } }),
        Order.countDocuments({ createdAt: { $gte: thisMonth } }),
        Order.countDocuments({ createdAt: { $gte: lastMonth, $lt: thisMonth } }),
        Order.countDocuments({ status: 'pending' }),
        Restaurant.countDocuments({ isActive: true, isOpen: true }),
        User.countDocuments({ createdAt: { $gte: today } }),
        User.countDocuments({ createdAt: { $gte: thisMonth } })
    ]);

    // Get revenue stats
    const revenueStats = await Order.aggregate([
        { $match: { status: 'delivered' } },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$pricing.total' },
                avgOrderValue: { $avg: '$pricing.total' }
            }
        }
    ]);

    const todayRevenue = await Order.aggregate([
        { $match: { status: 'delivered', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    const thisMonthRevenue = await Order.aggregate([
        { $match: { status: 'delivered', createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    // Get order status distribution
    const orderStatusDistribution = await Order.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    // Get recent orders
    const recentOrders = await Order.find()
        .sort('-createdAt')
        .limit(10)
        .populate('user', 'name')
        .populate('restaurant', 'name')
        .select('orderNumber status pricing.total createdAt');

    // Get top restaurants
    const topRestaurants = await Restaurant.find({ isActive: true })
        .sort({ 'ratings.average': -1, totalOrders: -1 })
        .limit(5)
        .select('name logo ratings totalOrders totalRevenue');

    // Get top foods
    const topFoods = await Food.find({ isAvailable: true })
        .sort({ orderCount: -1 })
        .limit(5)
        .populate('restaurant', 'name')
        .select('name mainImage orderCount ratings.average price');

    // Revenue chart data (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last7Days.push(date);
    }

    const revenueChart = await Order.aggregate([
        {
            $match: {
                status: 'delivered',
                createdAt: { $gte: last7Days[0] }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                revenue: { $sum: '$pricing.total' },
                orders: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
        success: true,
        data: {
            overview: {
                totalUsers,
                totalRestaurants,
                totalOrders,
                totalFoods,
                todayOrders,
                thisMonthOrders,
                lastMonthOrders,
                pendingOrders,
                activeRestaurants,
                newUsersToday,
                newUsersThisMonth
            },
            revenue: {
                total: revenueStats[0]?.totalRevenue || 0,
                avgOrderValue: Math.round(revenueStats[0]?.avgOrderValue || 0),
                today: todayRevenue[0]?.total || 0,
                thisMonth: thisMonthRevenue[0]?.total || 0
            },
            orderStatusDistribution,
            recentOrders,
            topRestaurants,
            topFoods,
            revenueChart
        }
    });
});

// @desc    Get restaurant dashboard stats
// @route   GET /api/dashboard/restaurant
// @access  Private/Restaurant
export const getRestaurantDashboard = asyncHandler(async (req, res) => {
    const restaurant = await Restaurant.findOne({ owner: req.user.id });

    if (!restaurant) {
        res.status(404);
        throw new Error('Restaurant not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    // Get order stats
    const [
        totalOrders,
        todayOrders,
        thisWeekOrders,
        thisMonthOrders,
        lastMonthOrders,
        pendingOrders,
        preparingOrders,
        completedOrders,
        cancelledOrders
    ] = await Promise.all([
        Order.countDocuments({ restaurant: restaurant._id }),
        Order.countDocuments({ restaurant: restaurant._id, createdAt: { $gte: today } }),
        Order.countDocuments({ restaurant: restaurant._id, createdAt: { $gte: thisWeek } }),
        Order.countDocuments({ restaurant: restaurant._id, createdAt: { $gte: thisMonth } }),
        Order.countDocuments({ restaurant: restaurant._id, createdAt: { $gte: lastMonth, $lt: thisMonth } }),
        Order.countDocuments({ restaurant: restaurant._id, status: 'pending' }),
        Order.countDocuments({ restaurant: restaurant._id, status: 'preparing' }),
        Order.countDocuments({ restaurant: restaurant._id, status: 'delivered' }),
        Order.countDocuments({ restaurant: restaurant._id, status: 'cancelled' })
    ]);

    // Get revenue
    const revenueStats = await Order.aggregate([
        { $match: { restaurant: restaurant._id, status: 'delivered' } },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$pricing.total' },
                avgOrderValue: { $avg: '$pricing.total' }
            }
        }
    ]);

    const todayRevenue = await Order.aggregate([
        { $match: { restaurant: restaurant._id, status: 'delivered', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    const thisMonthRevenue = await Order.aggregate([
        { $match: { restaurant: restaurant._id, status: 'delivered', createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    const lastMonthRevenue = await Order.aggregate([
        { $match: { restaurant: restaurant._id, status: 'delivered', createdAt: { $gte: lastMonth, $lt: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    // Calculate income change percentage
    const thisMonthRev = thisMonthRevenue[0]?.total || 0;
    const lastMonthRev = lastMonthRevenue[0]?.total || 0;
    const incomeChange = lastMonthRev > 0 ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 100) : 0;

    // Get menu stats
    const totalMenuItems = await Food.countDocuments({ restaurant: restaurant._id });
    const activeMenuItems = await Food.countDocuments({ restaurant: restaurant._id, isAvailable: true });

    // Get top selling items
    const topSellingItems = await Food.find({ restaurant: restaurant._id })
        .sort({ orderCount: -1 })
        .limit(5)
        .select('name mainImage orderCount price ratings.average');

    // Get recent orders
    const recentOrders = await Order.find({ restaurant: restaurant._id })
        .sort('-createdAt')
        .limit(10)
        .populate('user', 'name phone')
        .select('orderNumber status pricing.total items createdAt');

    // Get recent reviews
    const recentReviews = await Review.find({ restaurant: restaurant._id })
        .sort('-createdAt')
        .limit(5)
        .populate('user', 'name avatar')
        .select('rating comment createdAt');

    // ✅ Popular Foods (for pie chart)
    const popularFoods = await Food.aggregate([
        { $match: { restaurant: restaurant._id } },
        { $group: { _id: '$cuisine', count: { $sum: '$orderCount' } } },
        { $sort: { count: -1 } },
        { $limit: 3 }
    ]);

    const totalFoodOrders = popularFoods.reduce((acc, food) => acc + food.count, 0);
    const popularFoodsData = popularFoods.map((food, index) => ({
        name: food._id || 'Other',
        percentage: totalFoodOrders > 0 ? Math.round((food.count / totalFoodOrders) * 100) : 0,
        color: index === 0 ? 'primary' : index === 1 ? 'danger' : 'success'
    }));

    //  Order Rate Trend (last 12 months)
    const getLast12MonthsData = async () => {
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            months.push(date);
        }

        const thisYearData = await Promise.all(
            months.map(async (month) => {
                const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
                const orders = await Order.countDocuments({
                    restaurant: restaurant._id,
                    createdAt: { $gte: month, $lt: nextMonth }
                });
                return orders;
            })
        );

        const lastYearData = await Promise.all(
            months.map(async (month) => {
                const lastYearMonth = new Date(month.getFullYear() - 1, month.getMonth(), 1);
                const nextMonth = new Date(lastYearMonth.getFullYear(), lastYearMonth.getMonth() + 1, 1);
                const orders = await Order.countDocuments({
                    restaurant: restaurant._id,
                    createdAt: { $gte: lastYearMonth, $lt: nextMonth }
                });
                return orders;
            })
        );

        return { thisMonth: thisYearData, lastMonth: lastYearData };
    };

    const orderRateData = await getLast12MonthsData();

    //  Activity Chart (Income/Expense by month - last 12 months)
    const activityData = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
            const month = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
            const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
            
            const income = await Order.aggregate([
                {
                    $match: {
                        restaurant: restaurant._id,
                        status: 'delivered',
                        createdAt: { $gte: month, $lt: nextMonth }
                    }
                },
                { $group: { _id: null, total: { $sum: '$pricing.total' } } }
            ]);

            return income[0]?.total || 0;
        })
    );

    // For expense, you can calculate delivery fees, discounts, etc.
    const expenseData = activityData.map(income => Math.round(income * 0.15)); // Example: 15% of income as expense

    // Order trend (last 7 days)
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);

    const orderTrend = await Order.aggregate([
        {
            $match: {
                restaurant: restaurant._id,
                createdAt: { $gte: last7Days }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                orders: { $sum: 1 },
                revenue: { $sum: '$pricing.total' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // ✅ FINAL RESPONSE WITH ALL DATA
    res.status(200).json({
        success: true,
        data: {
            restaurant: {
                name: restaurant.name,
                isOpen: restaurant.isOpen,
                ratings: restaurant.ratings
            },
            // ✅ Stats for top income card
            stats: {
                totalIncome: revenueStats[0]?.totalRevenue || 0,
                income: thisMonthRev,
                expense: Math.round(thisMonthRev * 0.15), // Example: 15% of revenue
                incomeChange: incomeChange,
                expenseChange: -10 // You can calculate this based on actual expense data
            },
            // ✅ Order Metrics for the blue card
            orderMetrics: {
                completed: completedOrders,
                delivered: completedOrders,
                canceled: cancelledOrders,
                pending: pendingOrders
            },
            orders: {
                total: totalOrders,
                today: todayOrders,
                thisWeek: thisWeekOrders,
                thisMonth: thisMonthOrders,
                pending: pendingOrders,
                preparing: preparingOrders,
                completed: completedOrders,
                cancelled: cancelledOrders
            },
            revenue: {
                total: revenueStats[0]?.totalRevenue || 0,
                avgOrderValue: Math.round(revenueStats[0]?.avgOrderValue || 0),
                today: todayRevenue[0]?.total || 0
            },
            menu: {
                total: totalMenuItems,
                active: activeMenuItems
            },
            // ✅ Charts data
            performance: {
                percentage: restaurant.ratings.average ? Math.round((restaurant.ratings.average / 5) * 100) : 70
            },
            popularFoods: popularFoodsData.length > 0 ? popularFoodsData : [
                { name: 'No Data', percentage: 100, color: 'primary' }
            ],
            orderRate: orderRateData,
            activity: {
                income: activityData,
                expense: expenseData
            },
            topSellingItems,
            recentOrders,
            recentReviews,
            orderTrend
        }
    });
});
// @desc    Get delivery dashboard stats
// @route   GET /api/dashboard/delivery
// @access  Private/Delivery
export const getDeliveryDashboard = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Import Delivery model
    const Delivery = (await import('../models/Delivery.js')).default;

    const [
        totalDeliveries,
        todayDeliveries,
        thisWeekDeliveries,
        completedDeliveries,
        activeDeliveries,
        cancelledDeliveries
    ] = await Promise.all([
        Delivery.countDocuments({ deliveryPerson: req.user.id }),
        Delivery.countDocuments({ deliveryPerson: req.user.id, createdAt: { $gte: today } }),
        Delivery.countDocuments({ deliveryPerson: req.user.id, createdAt: { $gte: thisWeek } }),
        Delivery.countDocuments({ deliveryPerson: req.user.id, status: 'delivered' }),
        Delivery.countDocuments({ 
            deliveryPerson: req.user.id, 
            status: { $in: ['assigned', 'accepted', 'picked_up', 'on_the_way'] }
        }),
        Delivery.countDocuments({ deliveryPerson: req.user.id, status: 'cancelled' })
    ]);

    // Get earnings
    const earningsStats = await Delivery.aggregate([
        { $match: { deliveryPerson: req.user._id, status: 'delivered' } },
        {
            $group: {
                _id: null,
                totalEarnings: { $sum: '$earnings.total' },
                totalTips: { $sum: '$earnings.tip' }
            }
        }
    ]);

    const todayEarnings = await Delivery.aggregate([
        { 
            $match: { 
                deliveryPerson: req.user._id, 
                status: 'delivered',
                createdAt: { $gte: today }
            }
        },
        { $group: { _id: null, total: { $sum: '$earnings.total' } } }
    ]);

    // Get average rating
    const ratingStats = await Delivery.aggregate([
        { 
            $match: { 
                deliveryPerson: req.user._id, 
                'rating.score': { $exists: true }
            }
        },
        {
            $group: {
                _id: null,
                avgRating: { $avg: '$rating.score' },
                totalRatings: { $sum: 1 }
            }
        }
    ]);

    // Get active deliveries
    const activeDeliveriesList = await Delivery.find({
        deliveryPerson: req.user.id,
        status: { $in: ['assigned', 'accepted', 'picked_up', 'on_the_way'] }
    })
        .populate('order', 'orderNumber pricing.total')
        .populate('restaurant', 'name address')
        .populate('customer', 'name phone')
        .sort('-createdAt');

    // Earnings trend (last 7 days)
    const earningsTrend = await Delivery.aggregate([
        {
            $match: {
                deliveryPerson: req.user._id,
                status: 'delivered',
                createdAt: { $gte: thisWeek }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                earnings: { $sum: '$earnings.total' },
                deliveries: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
        success: true,
        data: {
            deliveries: {
                total: totalDeliveries,
                today: todayDeliveries,
                thisWeek: thisWeekDeliveries,
                completed: completedDeliveries,
                active: activeDeliveries,
                cancelled: cancelledDeliveries
            },
            earnings: {
                total: earningsStats[0]?.totalEarnings || 0,
                tips: earningsStats[0]?.totalTips || 0,
                today: todayEarnings[0]?.total || 0
            },
            rating: {
                average: Math.round((ratingStats[0]?.avgRating || 0) * 10) / 10,
                total: ratingStats[0]?.totalRatings || 0
            },
            activeDeliveries: activeDeliveriesList,
            earningsTrend
        }
    });
});

// @desc    Get user dashboard stats
// @route   GET /api/dashboard/user
// @access  Private
export const getUserDashboard = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get order stats
    const [
        totalOrders,
        thisMonthOrders,
        pendingOrders,
        completedOrders
    ] = await Promise.all([
        Order.countDocuments({ user: req.user.id }),
        Order.countDocuments({ user: req.user.id, createdAt: { $gte: thisMonth } }),
        Order.countDocuments({ 
            user: req.user.id, 
            status: { $in: ['pending', 'confirmed', 'preparing', 'on_the_way'] }
        }),
        Order.countDocuments({ user: req.user.id, status: 'delivered' })
    ]);

    // Get spending stats
    const spendingStats = await Order.aggregate([
        { $match: { user: req.user._id, status: 'delivered' } },
        {
            $group: {
                _id: null,
                totalSpent: { $sum: '$pricing.total' },
                avgOrderValue: { $avg: '$pricing.total' }
            }
        }
    ]);

    // Get recent orders
    const recentOrders = await Order.find({ user: req.user.id })
        .sort('-createdAt')
        .limit(5)
        .populate('restaurant', 'name logo')
        .select('orderNumber status pricing.total createdAt');

    // Get active orders
    const activeOrders = await Order.find({
        user: req.user.id,
        status: { $in: ['pending', 'confirmed', 'preparing', 'on_the_way'] }
    })
        .populate('restaurant', 'name logo phone')
        .populate('deliveryPerson', 'name phone')
        .sort('-createdAt');

    // Get favorite restaurants (most ordered from)
    const favoriteRestaurants = await Order.aggregate([
        { $match: { user: req.user._id } },
        { $group: { _id: '$restaurant', orderCount: { $sum: 1 } } },
        { $sort: { orderCount: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'restaurants',
                localField: '_id',
                foreignField: '_id',
                as: 'restaurant'
            }
        },
        { $unwind: '$restaurant' },
        {
            $project: {
                _id: '$restaurant._id',
                name: '$restaurant.name',
                logo: '$restaurant.logo',
                ratings: '$restaurant.ratings',
                orderCount: 1
            }
        }
    ]);

    // Get Favorite model for favorites
    const Favorite = (await import('../models/Favorite.js')).default;

    // Get user favorites count
    const favoriteFoodsCount = await Favorite.countDocuments({ 
        user: req.user.id, 
        type: 'food' 
    });
    const favoriteRestaurantsCount = await Favorite.countDocuments({ 
        user: req.user.id, 
        type: 'restaurant' 
    });

    res.status(200).json({
        success: true,
        data: {
            orders: {
                total: totalOrders,
                thisMonth: thisMonthOrders,
                pending: pendingOrders,
                completed: completedOrders
            },
            spending: {
                total: spendingStats[0]?.totalSpent || 0,
                avgOrderValue: Math.round(spendingStats[0]?.avgOrderValue || 0)
            },
            favorites: {
                foods: favoriteFoodsCount,
                restaurants: favoriteRestaurantsCount
            },
            recentOrders,
            activeOrders,
            favoriteRestaurants
        }
    });
});
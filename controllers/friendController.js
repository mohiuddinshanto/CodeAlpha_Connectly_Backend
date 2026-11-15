import {
  acceptFriendRequest,
  getFriendStatus,
  listFriendRequests,
  listFriends,
  removeFriendRequest,
  sendFriendRequest,
} from '../services/friendService.js';

export async function getFriendsHandler(req, res, next) {
  try {
    const friends = await listFriends(req.userId);
    res.json({ success: true, friends });
  } catch (err) {
    next(err);
  }
}

export async function getFriendRequestsHandler(req, res, next) {
  try {
    const requests = await listFriendRequests(req.userId);
    res.json({ success: true, ...requests });
  } catch (err) {
    next(err);
  }
}

export async function getFriendStatusHandler(req, res, next) {
  try {
    const status = await getFriendStatus(req.userId, req.params.userId);
    res.json({ success: true, ...status });
  } catch (err) {
    next(err);
  }
}

export async function sendFriendRequestHandler(req, res, next) {
  try {
    const result = await sendFriendRequest(req.userId, req.params.userId);
    res.status(result.status === 'pending_sent' ? 201 : 200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function acceptFriendRequestHandler(req, res, next) {
  try {
    const result = await acceptFriendRequest(req.userId, req.params.requestId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function removeFriendRequestHandler(req, res, next) {
  try {
    await removeFriendRequest(req.userId, req.params.requestId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

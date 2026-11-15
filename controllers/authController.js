import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getCollections, parseObjectId } from '../config/database.js';
import {
  clearAuthCookie,
  setAuthCookie,
  signAuthToken,
} from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { formatUserProfile } from '../services/userService.js';
import {
  validateEmail,
  validateFullName,
  validatePassword,
  validateUsername,
} from '../validators/index.js';

export async function register(req, res, next) {
  try {
    const { name, username, email, password, profilePicture } = req.body || {};

    const nameRes = validateFullName(name);
    if (!nameRes.valid) throw new AppError(nameRes.error, 400);

    const usernameRes = validateUsername(username);
    if (!usernameRes.valid) throw new AppError(usernameRes.error, 400);

    const emailRes = validateEmail(email);
    if (!emailRes.valid) throw new AppError(emailRes.error, 400);

    const passRes = validatePassword(password);
    if (!passRes.valid) throw new AppError(passRes.error, 400);

    const cols = getCollections();
    const [existingEmail, existingUsername] = await Promise.all([
      cols.users.findOne({ email: emailRes.value }),
      cols.users.findOne({ username: usernameRes.value }),
    ]);

    if (existingEmail) {
      throw new AppError(
        'An account with that email already exists.',
        409,
        'DUPLICATE_EMAIL'
      );
    }
    if (existingUsername) {
      throw new AppError(
        'That username is already taken.',
        409,
        'DUPLICATE_USERNAME'
      );
    }

    const passwordHash = await bcrypt.hash(passRes.value, 10);
    const now = new Date();
    const avatar =
      typeof profilePicture === 'string' && profilePicture.trim().length > 0
        ? profilePicture.trim()
        : '';

    const newUser = {
      _id: new ObjectId(),
      name: nameRes.value,
      username: usernameRes.value,
      email: emailRes.value,
      password: passwordHash,
      profilePicture: avatar,
      bio: '',
      createdAt: now,
      updatedAt: now,
    };

    await cols.users.insertOne(newUser);

    const token = signAuthToken(newUser._id.toHexString());
    setAuthCookie(req, res, token);

    const userDto = await formatUserProfile(
      newUser,
      newUser._id.toHexString(),
      true
    );

    res.status(201).json({
      success: true,
      user: userDto,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password, rememberMe = true } = req.body || {};

    const emailRes = validateEmail(email);
    if (!emailRes.valid) throw new AppError(emailRes.error, 400);

    if (typeof password !== 'string' || !password) {
      throw new AppError('Password is required.', 400);
    }

    const cols = getCollections();
    const user = await cols.users.findOne({ email: emailRes.value });
    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = signAuthToken(user._id.toHexString());
    setAuthCookie(req, res, token, rememberMe !== false);

    const userDto = await formatUserProfile(
      user,
      user._id.toHexString(),
      true
    );

    res.json({
      success: true,
      user: userDto,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, _next) {
  clearAuthCookie(req, res);
  res.json({
    success: true,
    message: 'Signed out successfully.',
  });
}

export async function getMe(req, res, next) {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }
    const oid = parseObjectId(userId);
    if (!oid) {
      throw new AppError('Invalid session token.', 401, 'UNAUTHORIZED');
    }
    const cols = getCollections();
    const user = await cols.users.findOne({ _id: oid });
    if (!user) {
      clearAuthCookie(req, res);
      throw new AppError('User account no longer exists.', 401, 'UNAUTHORIZED');
    }

    const userDto = await formatUserProfile(user, userId, true);
    res.json({
      success: true,
      user: userDto,
    });
  } catch (err) {
    next(err);
  }
}

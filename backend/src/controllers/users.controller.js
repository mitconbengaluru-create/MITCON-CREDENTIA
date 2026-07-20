import { UsersService, CreateUserDto, UpdateUserDto, UserResponseDto, USER_MESSAGES } from '../users/users.service.js';
import { userMapper } from '../utils/users.util.js';

const usersService = new UsersService();

/**
 * Controller class managing Express HTTP layer users interfaces.
 * Decouples routes from raw business operations.
 */
export class UsersController {
  /**
   * Handles user creation requests.
   * 
   * @async
   * @method createUser
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async createUser(req, res, next) {
    try {
      const createUserDto = CreateUserDto.fromRequest(req.body);
      const result = await usersService.createUser(createUserDto);
      
      const responseData = userMapper(result);

      res.status(201).json({
        success: true,
        message: USER_MESSAGES.CREATE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles user profile update requests.
   * 
   * @async
   * @method updateUser
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updateUserDto = UpdateUserDto.fromRequest(req.body);
      const result = await usersService.updateUser(id, updateUserDto);

      const responseData = userMapper(result);

      res.status(200).json({
        success: true,
        message: USER_MESSAGES.UPDATE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves profile details of a specific user.
   * 
   * @async
   * @method getUser
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async getUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await usersService.getUser(id);

      const responseData = userMapper(result);

      res.status(200).json({
        success: true,
        message: USER_MESSAGES.RETRIEVE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles listing user account request query filters.
   * 
   * @async
   * @method listUsers
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async listUsers(req, res, next) {
    try {
      const filters = req.query;
      const result = await usersService.listUsers(filters);

      const usersListResponse = result.users.map(userMapper);

      res.status(200).json({
        success: true,
        message: USER_MESSAGES.LIST_SUCCESS,
        data: {
          users: usersListResponse,
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Sets target user account configuration state to ACTIVE.
   * 
   * @async
   * @method activateUser
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async activateUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await usersService.activateUser(id);

      const responseData = userMapper(result);

      res.status(200).json({
        success: true,
        message: USER_MESSAGES.ACTIVATE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Sets target user account configuration state to INACTIVE.
   * 
   * @async
   * @method deactivateUser
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async deactivateUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await usersService.deactivateUser(id);

      const responseData = userMapper(result);

      res.status(200).json({
        success: true,
        message: USER_MESSAGES.DEACTIVATE_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default UsersController;

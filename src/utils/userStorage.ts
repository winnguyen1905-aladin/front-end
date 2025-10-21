// Utility for managing user information in localStorage

export interface UserInfo {
  name: string;
  lastOnline: string;
}

const USER_INFO_KEY = 'aladin_user_info';

export class UserStorage {
  /**
   * Save user info to localStorage
   */
  static saveUserInfo(userInfo: UserInfo): void {
    try {
      console.log('💾 UserStorage.saveUserInfo - Saving:', userInfo);
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
      console.log('✅ UserStorage.saveUserInfo - Saved successfully');
    } catch (error) {
      console.error('❌ UserStorage.saveUserInfo - Failed to save:', error);
    }
  }

  /**
   * Get user info from localStorage
   */
  static getUserInfo(): UserInfo | null {
    try {
      const stored = localStorage.getItem(USER_INFO_KEY);
      console.log('📖 UserStorage.getUserInfo - Raw stored value:', stored);

      if (!stored) {
        console.log('⚠️ UserStorage.getUserInfo - No data found');
        return null;
      }
      const parsed = JSON.parse(stored) as any;
      console.log('✅ UserStorage.getUserInfo - Parsed:', parsed);
      return parsed;
    } catch (error) {
      console.error('❌ UserStorage.getUserInfo - Failed to get:', error);
      return null;
    }
  }

  /**
   * Check if user is registered (has username in localStorage)
   */
  static isUserRegistered(): boolean {
    const userInfo = this.getUserInfo();
    return userInfo !== null && !!userInfo.name;
  }

  /**
   * Get username from localStorage
   */
  static getUsername(): string | null {
    const userInfo = this.getUserInfo();
    return userInfo?.name || null;
  }

  /**
   * Update last online timestamp
   */
  static updateLastOnline(): void {
    const userInfo = this.getUserInfo();
    if (userInfo) {
      userInfo.lastOnline = new Date().toISOString();
      this.saveUserInfo(userInfo);
    }
  }

  /**
   * Clear user info from localStorage
   */
  static clearUserInfo(): void {
    try {
      localStorage.removeItem(USER_INFO_KEY);
    } catch (error) {
      console.error('Failed to clear user info from localStorage:', error);
    }
  }
}


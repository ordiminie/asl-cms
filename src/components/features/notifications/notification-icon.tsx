interface NotificationIconProps {
  type: string
  read: boolean
}

export default function NotificationIcon({type, read}: NotificationIconProps) {
  const baseClasses = `flex h-10 w-10 items-center justify-center rounded-full text-white ${
    read ? 'opacity-60' : ''
  }`

  const getIconAndColor = (type: string) => {
    switch (type) {
      case 'system':
        return {
          bg: 'bg-blue-500',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          ),
        }
      case 'project_created':
      case 'project_updated':
        return {
          bg: 'bg-green-500',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
            </svg>
          ),
        }
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_canceled':
        return {
          bg: 'bg-purple-500',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M17,13H13V17H11V13H7V11H11V7H13V11H17V13Z" />
            </svg>
          ),
        }
      case 'payment_succeeded':
      case 'payment_failed':
        return {
          bg: type === 'payment_succeeded' ? 'bg-green-500' : 'bg-red-500',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20,8H4V6C4,4.89 4.89,4 6,4H18A2,2 0 0,1 20,6V8M20,8A2,2 0 0,1 22,10V16A2,2 0 0,1 20,18H4A2,2 0 0,1 2,16V10A2,2 0 0,1 4,8H20M16,11.5A1.5,1.5 0 0,0 14.5,10A1.5,1.5 0 0,0 13,11.5A1.5,1.5 0 0,0 14.5,13A1.5,1.5 0 0,0 16,11.5Z" />
            </svg>
          ),
        }
      case 'organization_invitation':
        return {
          bg: 'bg-orange-500',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z" />
            </svg>
          ),
        }
      case 'security_alert':
        return {
          bg: 'bg-red-500',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11.5C15.4,11.5 16,12.4 16,13V16C16,17.4 15.4,18 14.8,18H9.2C8.6,18 8,17.4 8,16V13C8,12.4 8.6,11.5 9.2,11.5V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,10V11.5H13.5V10C13.5,8.7 12.8,8.2 12,8.2Z" />
            </svg>
          ),
        }
      case 'user_banned':
      case 'user_unbanned':
        return {
          bg: type === 'user_banned' ? 'bg-red-500' : 'bg-green-500',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,8.39C13.57,9.4 15.42,10 17.42,10C17.8,10 18.16,10 18.53,9.95C18.17,15.29 15.71,18.6 12,18.6C8.29,18.6 5.83,15.29 5.47,9.95C5.84,10 6.2,10 6.58,10C8.58,10 10.43,9.4 12,8.39Z" />
            </svg>
          ),
        }
      case 'system_maintenance':
        return {
          bg: 'bg-yellow-500',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.98C19.47,12.66 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11.02L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.02C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.66 4.57,12.98L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.98Z" />
            </svg>
          ),
        }
      default:
        return {
          bg: 'bg-gray-500',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17A1.5,1.5 0 0,1 10.5,15.5A1.5,1.5 0 0,1 12,14A1.5,1.5 0 0,1 13.5,15.5A1.5,1.5 0 0,1 12,17M14.5,10.5C14.5,9 13.36,7.5 12,7.5C10.64,7.5 9.5,9 9.5,10.5H11C11,9.66 11.45,9 12,9C12.55,9 13,9.66 13,10.5C13,11.1 12.77,11.5 12.43,11.86C12,12.29 11.5,12.86 11.5,14H12.5C12.5,13.14 12.77,12.5 13.14,12.14C13.64,11.64 14.5,11.1 14.5,10.5Z" />
            </svg>
          ),
        }
    }
  }

  const {bg, icon} = getIconAndColor(type)

  return <div className={`${baseClasses} ${bg}`}>{icon}</div>
}

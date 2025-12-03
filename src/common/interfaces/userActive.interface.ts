export interface UserActiveI {
  userId: string;
  username: string;
  role: string;
  allowedFloorIds: string[];
  iat?: number;
  exp?: number;
}

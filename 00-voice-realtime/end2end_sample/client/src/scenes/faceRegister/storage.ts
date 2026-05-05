/**
 * Face Register Scene - LocalStorage 管理
 * 存储和读取人脸记录
 */

const STORAGE_KEY = 'face_records';

/**
 * 人脸记录接口
 */
export interface FaceRecord {
  /** 用户名字 */
  name: string;
  /** 128维人脸特征向量 */
  descriptor: number[];
  /** 创建时间戳 */
  createdAt: number;
  /** 可选：人脸缩略图 base64 */
  thumbnail?: string;
}

/**
 * 获取所有人脸记录
 */
export function getFaceRecords(): FaceRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as FaceRecord[];
  } catch (error) {
    console.error('[FaceStorage] 读取记录失败:', error);
    return [];
  }
}

/**
 * 保存人脸记录
 * 如果名字已存在，则更新；否则新增
 */
export function saveFaceRecord(record: Omit<FaceRecord, 'createdAt'>): void {
  try {
    const records = getFaceRecords();
    const existingIndex = records.findIndex(r => r.name === record.name);

    const newRecord: FaceRecord = {
      ...record,
      createdAt: Date.now(),
    };

    if (existingIndex >= 0) {
      // 更新已有记录
      records[existingIndex] = newRecord;
      console.log('[FaceStorage] 更新记录:', record.name);
    } else {
      // 新增记录
      records.push(newRecord);
      console.log('[FaceStorage] 新增记录:', record.name);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('[FaceStorage] 保存记录失败:', error);
    throw error;
  }
}

/**
 * 删除人脸记录
 */
export function deleteFaceRecord(name: string): boolean {
  try {
    const records = getFaceRecords();
    const filteredRecords = records.filter(r => r.name !== name);

    if (filteredRecords.length === records.length) {
      return false; // 没有找到该记录
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecords));
    console.log('[FaceStorage] 删除记录:', name);
    return true;
  } catch (error) {
    console.error('[FaceStorage] 删除记录失败:', error);
    return false;
  }
}

/**
 * 清空所有人脸记录
 */
export function clearAllFaceRecords(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[FaceStorage] 已清空所有记录');
}

/**
 * 获取所有已注册的名字列表
 */
export function getRegisteredNames(): string[] {
  return getFaceRecords().map(r => r.name);
}

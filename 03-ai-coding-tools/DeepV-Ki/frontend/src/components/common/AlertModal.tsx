'use client';

import React from 'react';
import { FaInfoCircle, FaCheckCircle, FaExclamationCircle, FaTimesCircle } from 'react-icons/fa';
import Modal from './Modal';
import Button from './Button';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: AlertType;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm?: () => void;
  showCancel?: boolean;
  cancelText?: string;
  onCancel?: () => void;
}

const iconMap = {
  info: { icon: FaInfoCircle, color: 'text-blue-500' },
  success: { icon: FaCheckCircle, color: 'text-green-500' },
  warning: { icon: FaExclamationCircle, color: 'text-yellow-500' },
  error: { icon: FaTimesCircle, color: 'text-red-500' },
};

export default function AlertModal({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  confirmText = '确定',
  onConfirm,
  showCancel = false,
  cancelText = '取消',
  onCancel,
}: AlertModalProps) {
  const { icon: Icon, color } = iconMap[type];

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          {showCancel && (
            <Button
              variant="ghost"
              onClick={handleCancel}
            >
              {cancelText}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0 pt-0.5">
          <Icon className={`${color} w-6 h-6`} />
        </div>
        <div className="flex-1">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
}

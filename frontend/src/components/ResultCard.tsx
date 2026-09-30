import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Pill, XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ResultCardProps {
  status: 'fresh' | 'spoiled' | 'uncertain';
  confidence: number;
  date: Date;
  foodType: string;
}

export const ResultCard: React.FC<ResultCardProps> = ({ status, confidence, date, foodType }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'fresh':
        return {
          icon: CheckCircle,
          color: 'text-sage-600',
          bgColor: 'bg-sage-50',
          label: 'Fresh',
        };
      case 'spoiled':
        return {
          icon: XCircle,
          color: 'text-terracotta-600',
          bgColor: 'bg-terracotta-50',
          label: 'Spoiled',
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          label: 'Uncertain',
        };
    }
  };

  if (confidence < 70) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
            <XIcon className="w-6 h-6 text-gray-500" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No Objects Detected</h3>
        <p className="text-gray-600 mb-4">
          Our model couldn't detect any objects in this image. This might happen if:
        </p>
        <ul className="text-gray-600 space-y-2 mb-4">
          <li>The image quality is too low</li>
          <li>The objects are not in our training dataset</li>
          <li>The objects are too small or unclear</li>
        </ul>
        <p className="text-gray-600">
          Try uploading a different image with clearer objects.
        </p>
      </div>
    );
  }

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="result-card">
      <div className="flex items-center justify-between mb-4">
        <div className={`inline-flex items-center px-3 py-1 rounded-full ${config.bgColor} ${config.color} text-sm font-medium`}>
          <Icon className="w-4 h-4 mr-2" />
          {config.label}
        </div>
        <div className="text-lg font-semibold text-gray-700">{foodType}</div>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Confidence</p>
          <div className="mt-1 relative pt-1">
            <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-100">
              <div
                style={{ width: `${confidence}%` }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                  status === 'fresh' ? 'bg-sage-500' : 'bg-terracotta-500'
                }`}
              ></div>
            </div>
            <span className="text-sm font-semibold text-gray-700 mt-1">
              {confidence}%
            </span>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Analyzed on</p>
          <p className="text-sm text-gray-700">
            {date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        
        {status === 'spoiled' && confidence >= 70 && (
          <Link
            to="/medicine-guide"
            className="inline-flex items-center px-4 py-2 bg-terracotta-50 text-terracotta-600 rounded-lg hover:bg-terracotta-100 transition-colors mt-2 text-sm font-medium"
          >
            <Pill className="w-4 h-4 mr-2" />
            View Treatment Guide
          </Link>
        )}
      </div>
    </div>
  );
};

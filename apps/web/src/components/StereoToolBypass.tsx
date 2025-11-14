import { useState, useEffect } from 'react';
import { useIoT } from '../contexts/IoTContext';

interface StereoToolStatus {
  isRunning: boolean;
  isBypassed: boolean;
  currentPreset: string;
  uptime?: number;
  lastUpdate: string;
}

export default function StereoToolBypass() {
  const iot = useIoT();
  const [status, setStatus] = useState<StereoToolStatus>({
    isRunning: false,
    isBypassed: true,
    currentPreset: '/opt/radio/preset.sts',
    lastUpdate: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to IoT status updates
  useEffect(() => {
    if (!iot.isConnected) return;

    const handleStatusUpdate = (message: any) => {
      console.log('📡 Stereo Tool status update:', message);
      if (message.status) {
        setStatus(message.status);
      }
    };

    iot.subscribe('stereo-tool/status', handleStatusUpdate);

    // Fetch initial status
    fetchStatus();

    // Cleanup - if unsubscribe exists
    return () => {
      // IoT context may not have unsubscribe, cleanup handled automatically
    };
  }, [iot.isConnected]);

  /**
   * Fetch current Stereo Tool status
   */
  const fetchStatus = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/stereo-tool/status`
      );
      const data = await response.json();
      if (data.success && data.status) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  /**
   * Toggle bypass mode
   */
  const toggleBypass = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const action = status.isBypassed ? 'unbypass' : 'bypass';
      
      console.log(`🎚️ ${action === 'bypass' ? 'Enabling' : 'Disabling'} bypass...`);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/stereo-tool/control`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action })
        }
      );

      const data = await response.json();

      if (data.success && data.status) {
        setStatus(data.status);
        console.log('✅ Bypass toggled successfully');
      } else {
        throw new Error(data.error || 'Failed to toggle bypass');
      }
    } catch (error) {
      console.error('❌ Failed to toggle bypass:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Restart Stereo Tool
   */
  const restart = async () => {
    if (!confirm('Restart Stereo Tool? This will cause a brief audio interruption.')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/stereo-tool/control`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'restart' })
        }
      );

      const data = await response.json();

      if (data.success && data.status) {
        setStatus(data.status);
        console.log('✅ Stereo Tool restarted');
      } else {
        throw new Error(data.error || 'Failed to restart');
      }
    } catch (error) {
      console.error('❌ Failed to restart:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Format uptime
   */
  const formatUptime = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🎚️</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Stereo Tool Audio Processing
            </h3>
            <p className="text-sm text-gray-500">
              Professional audio enhancement & loudness
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`} />
          <span className="text-sm font-medium text-gray-700">
            {status.isRunning ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Bypass Toggle */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label htmlFor="bypass-toggle" className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <span>Processing Bypass</span>
              {status.isBypassed && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  RAW AUDIO
                </span>
              )}
              {!status.isBypassed && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                  PROCESSED
                </span>
              )}
            </label>
            <p className="text-xs text-gray-600 mt-1">
              {status.isBypassed 
                ? 'Audio bypasses Stereo Tool (no processing)'
                : 'Audio processed through Stereo Tool (EQ, compression, loudness)'}
            </p>
          </div>

          {/* Toggle Switch */}
          <button
            id="bypass-toggle"
            onClick={toggleBypass}
            disabled={isLoading}
            className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              status.isBypassed ? 'bg-gray-300' : 'bg-purple-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                status.isBypassed ? 'translate-x-0' : 'translate-x-6'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Status Info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-gray-50 rounded">
          <div className="text-xs text-gray-500 mb-1">Status</div>
          <div className="text-sm font-medium text-gray-900">
            {status.isRunning ? '✅ Running' : '⭕ Stopped'}
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded">
          <div className="text-xs text-gray-500 mb-1">Uptime</div>
          <div className="text-sm font-medium text-gray-900">
            {formatUptime(status.uptime)}
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded col-span-2">
          <div className="text-xs text-gray-500 mb-1">Current Preset</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {status.currentPreset}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={restart}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🔄 Restart
        </button>

        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ♻️ Refresh
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Last Update */}
      <div className="mt-4 text-xs text-gray-400 text-center">
        Last updated: {new Date(status.lastUpdate).toLocaleTimeString()}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Enable bypass for troubleshooting or to hear the raw audio stream. 
          Disable bypass for professional sound with EQ, compression, and loudness maximization.
        </div>
      </div>
    </div>
  );
}

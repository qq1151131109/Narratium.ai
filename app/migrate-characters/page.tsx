/**
 * Character Migration Tool Page
 *
 * This page allows users to migrate their character cards from browser storage (IndexedDB)
 * to server storage, making characters accessible to all users.
 */

"use client";

import { useState } from "react";
import { ServerCharacterOperations } from "@/lib/data/roleplay/server-character-operation";
import { LocalCharacterRecordOperations } from "@/lib/data/roleplay/character-record-operation";

export default function MigrationPage() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const [localCharacterCount, setLocalCharacterCount] = useState<number>(0);
  const [serverCharacterCount, setServerCharacterCount] = useState<number>(0);

  // Load character counts
  const loadCounts = async () => {
    try {
      const localChars = await LocalCharacterRecordOperations.getAllCharacters();
      const serverChars = await ServerCharacterOperations.getAllCharacters();
      setLocalCharacterCount(localChars.length);
      setServerCharacterCount(serverChars.length);
    } catch (error) {
      console.error("Error loading counts:", error);
    }
  };

  // Handle migration
  const handleMigrate = async () => {
    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const result = await ServerCharacterOperations.migrateFromIndexedDB();
      setMigrationResult(result);
      await loadCounts();
    } catch (error) {
      console.error("Migration error:", error);
      alert("迁移失败，请查看控制台错误信息");
    } finally {
      setIsMigrating(false);
    }
  };

  // Load counts on mount
  useState(() => {
    loadCounts();
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold text-purple-900 mb-2">
            角色卡迁移工具
          </h1>
          <p className="text-gray-600">
            将您的角色卡从浏览器本地存储迁移到服务器，让所有用户都能访问
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Local Storage Status */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  浏览器本地存储
                </h3>
                <p className="text-sm text-gray-500">IndexedDB</p>
              </div>
            </div>
            <div className="text-4xl font-bold text-blue-600">
              {localCharacterCount}
            </div>
            <p className="text-gray-600 mt-2">个角色卡</p>
          </div>

          {/* Server Storage Status */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  服务器存储
                </h3>
                <p className="text-sm text-gray-500">所有人可访问</p>
              </div>
            </div>
            <div className="text-4xl font-bold text-green-600">
              {serverCharacterCount}
            </div>
            <p className="text-gray-600 mt-2">个角色卡</p>
          </div>
        </div>

        {/* Migration Instructions */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">迁移说明</h2>
          <div className="space-y-3 text-gray-700">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                <span className="text-purple-600 text-sm font-bold">1</span>
              </div>
              <p>
                <strong>当前状态：</strong>
                角色卡存储在浏览器的 IndexedDB
                中，每个浏览器有独立的数据
              </p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                <span className="text-purple-600 text-sm font-bold">2</span>
              </div>
              <p>
                <strong>迁移后：</strong>
                角色卡将存储在服务器上，所有用户访问同一组角色卡
              </p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                <span className="text-purple-600 text-sm font-bold">3</span>
              </div>
              <p>
                <strong>注意：</strong>
                迁移会复制角色卡到服务器，不会删除浏览器中的数据
              </p>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                <span className="text-purple-600 text-sm font-bold">4</span>
              </div>
              <p>
                <strong>共享访问：</strong>
                迁移后，新用户打开网站就能看到所有角色卡
              </p>
            </div>
          </div>
        </div>

        {/* Migration Button */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <button
            onClick={handleMigrate}
            disabled={isMigrating || localCharacterCount === 0}
            className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
              isMigrating || localCharacterCount === 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl"
            }`}
          >
            {isMigrating ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                迁移中...
              </span>
            ) : localCharacterCount === 0 ? (
              "没有需要迁移的角色卡"
            ) : (
              `开始迁移 ${localCharacterCount} 个角色卡`
            )}
          </button>
        </div>

        {/* Migration Result */}
        {migrationResult && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">迁移结果</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <span className="text-green-800 font-semibold">
                  成功迁移
                </span>
                <span className="text-2xl font-bold text-green-600">
                  {migrationResult.success}
                </span>
              </div>
              {migrationResult.failed > 0 && (
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <span className="text-red-800 font-semibold">失败</span>
                  <span className="text-2xl font-bold text-red-600">
                    {migrationResult.failed}
                  </span>
                </div>
              )}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800">
                  ✅ 迁移完成！现在所有用户都可以访问这些角色卡了。
                </p>
                <p className="text-blue-600 mt-2 text-sm">
                  您可以前往{" "}
                  <a
                    href="/character-cards"
                    className="underline font-semibold hover:text-blue-800"
                  >
                    角色卡页面
                  </a>{" "}
                  查看。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-6 text-center">
          <a
            href="/character-cards"
            className="inline-flex items-center text-purple-600 hover:text-purple-800 font-semibold"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            返回角色卡页面
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * PAAW A2A Server
 *
 * 把 PAAW 的 Skills 透過 A2A 協議暴露出去，
 * 讓外部 Agent 可以發現和呼叫。
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AgentCard, AGENT_CARD_PATH, Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent } from '@a2a-js/sdk';
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
  DefaultRequestHandler,
  InMemoryTaskStore,
  InMemoryPushNotificationStore,
  DefaultPushNotificationSender,
} from '@a2a-js/sdk/server';
import {
  agentCardHandler,
  jsonRpcHandler,
  restHandler,
  UserBuilder,
} from '@a2a-js/sdk/server/express';

// ════════════════════════════════════════════════════════
// 1. Agent Card — 告訴別人我是誰、會什麼
// ════════════════════════════════════════════════════════

const PAAW_AGENT_CARD: AgentCard = {
  name: 'PAAW Agent',
  description: 'Personal AI Assistant Workspace — 翻譯、新聞摘要、文件處理等 Skill 執行引擎',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  url: 'http://localhost:4100/a2a/jsonrpc',
  skills: [
    {
      id: 'translate',
      name: '翻譯',
      description: '將文字翻譯為目標語言，同時識別特殊詞彙（成語、俚語、專業術語），產出學習筆記',
      tags: ['translate', 'language', 'learning'],
    },
    {
      id: 'ai-news-digest',
      name: 'AI 新聞摘要',
      description: '自動搜集並摘要 AI 領域最新新聞',
      tags: ['news', 'ai', 'digest'],
    },
  ],
  capabilities: {
    streaming: true,
    pushNotifications: true,
    stateTransitionHistory: true,
  },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  additionalInterfaces: [
    { url: 'http://localhost:4100/a2a/jsonrpc', transport: 'JSONRPC' },
    { url: 'http://localhost:4100/a2a/rest', transport: 'HTTP+JSON' },
  ],
};

// ════════════════════════════════════════════════════════
// 2. Agent Executor — 你唯一要寫的邏輯
// ════════════════════════════════════════════════════════

class PaawExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId, userMessage, task } = requestContext;

    // ── 建立 Task（如果還沒有）──
    if (!task) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId,
        status: { state: 'submitted', timestamp: new Date().toISOString() },
        history: [userMessage],
      };
      eventBus.publish(initialTask);
    }

    // ── 狀態：WORKING ──
    eventBus.publish({
      kind: 'status-update',
      taskId,
      contextId,
      status: { state: 'working', timestamp: new Date().toISOString() },
      final: false,
    } as TaskStatusUpdateEvent);

    // ── 解析使用者訊息 ──
    const userText = userMessage.parts
      .filter((p): p is { kind: 'text'; text: string } => p.kind === 'text')
      .map(p => p.text)
      .join('\n');

    console.log(`[A2A] Task ${taskId}: received "${userText.slice(0, 100)}"`);

    try {
      // ── 執行 PAAW Skill（目前用簡單實作，之後接 PAAW API）──
      const result = await this.executeSkill(taskId, userText, eventBus, contextId);

      // ── 檢查是否被取消 ──
      if (this.cancelledTasks.has(taskId)) {
        eventBus.publish({
          kind: 'status-update',
          taskId,
          contextId,
          status: { state: 'canceled', timestamp: new Date().toISOString() },
          final: true,
        } as TaskStatusUpdateEvent);
        eventBus.finished();
        this.cancelledTasks.delete(taskId);
        return;
      }

      // ── 產出 Artifact ──
      eventBus.publish({
        kind: 'artifact-update',
        taskId,
        contextId,
        artifact: {
          artifactId: `${taskId}-result`,
          name: 'result',
          parts: [{ kind: 'text', text: result }],
        },
      } as TaskArtifactUpdateEvent);

      // ── 狀態：COMPLETED ──
      eventBus.publish({
        kind: 'status-update',
        taskId,
        contextId,
        status: { state: 'completed', timestamp: new Date().toISOString() },
        final: true,
      } as TaskStatusUpdateEvent);

      console.log(`[A2A] Task ${taskId}: completed`);

    } catch (err: any) {
      // ── 狀態：FAILED ──
      eventBus.publish({
        kind: 'status-update',
        taskId,
        contextId,
        status: {
          state: 'failed',
          message: {
            kind: 'message',
            role: 'agent',
            messageId: uuidv4(),
            parts: [{ kind: 'text', text: `執行失敗: ${err.message}` }],
            taskId,
            contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      } as TaskStatusUpdateEvent);

      console.error(`[A2A] Task ${taskId}: failed — ${err.message}`);
    }

    eventBus.finished();
  }

  async cancelTask(taskId: string, eventBus: ExecutionEventBus): Promise<void> {
    console.log(`[A2A] Cancel requested for task ${taskId}`);
    this.cancelledTasks.add(taskId);
  }

  /**
   * 執行 PAAW Skill
   * 目前用簡單 echo + 翻譯示範，之後改成呼叫 PAAW API
   */
  private async executeSkill(
    taskId: string,
    userText: string,
    eventBus: ExecutionEventBus,
    contextId: string,
  ): Promise<string> {
    // 模擬工作過程（之後換成真的 PAAW agent loop 呼叫）
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 簡單示範：echo + 加上時間戳
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    return `✅ PAAW A2A Server 收到你的訊息：\n\n"${userText}"\n\n⏰ 處理時間：${timestamp}\n🆔 Task ID：${taskId}`;
  }
}

// ════════════════════════════════════════════════════════
// 3. 組裝 Express Server
// ════════════════════════════════════════════════════════

const PORT = 4100;

const agentExecutor = new PaawExecutor();
const taskStore = new InMemoryTaskStore();
const pushNotificationStore = new InMemoryPushNotificationStore();
const pushNotificationSender = new DefaultPushNotificationSender(pushNotificationStore, {
  timeout: 5000,
  tokenHeaderName: 'X-A2A-Notification-Token',
});

const requestHandler = new DefaultRequestHandler(
  PAAW_AGENT_CARD,
  taskStore,
  agentExecutor,
  undefined, // eventBusManager（用預設的）
  pushNotificationStore,
  pushNotificationSender,
);

const app = express();

// Agent Card endpoint
app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));

// JSON-RPC endpoint（主要使用）
app.use('/a2a/jsonrpc', jsonRpcHandler({
  requestHandler,
  userBuilder: UserBuilder.noAuthentication,
}));

// REST endpoint
app.use('/a2a/rest', restHandler({
  requestHandler,
  userBuilder: UserBuilder.noAuthentication,
}));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: PAAW_AGENT_CARD.name, version: PAAW_AGENT_CARD.version });
});

// Start
app.listen(PORT, () => {
  console.log(`\n🚀 PAAW A2A Server 已啟動`);
  console.log(`   Agent Card : http://localhost:${PORT}/${AGENT_CARD_PATH}`);
  console.log(`   JSON-RPC   : http://localhost:${PORT}/a2a/jsonrpc`);
  console.log(`   REST       : http://localhost:${PORT}/a2a/rest`);
  console.log(`   Health     : http://localhost:${PORT}/health\n`);
});

// 测试 AttributeViewDB 的增删查改功能
import { AttributeViewDB } from './index.js';

/**
 * 测试工具函数
 */
class TestUtils {
  static log(message, data = null) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    if (data) {
      console.log('数据:', JSON.stringify(data, null, 2));
    }
  }

  static error(message, error = null) {
    console.error(`[${new Date().toISOString()}] ❌ ${message}`);
    if (error) {
      console.error('错误详情:', error.message);
    }
  }

  static success(message) {
    console.log(`[${new Date().toISOString()}] ✅ ${message}`);
  }

  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * AttributeViewDB CRUD 测试类
 */
class AttributeViewDBTest {
  constructor() {
    this.db = new AttributeViewDB({
      baseUrl: 'http://127.0.0.1:6806',
      apiToken: '' // 如果需要认证，请填入你的API token
    });
    this.testAvID = null;
    this.testColumnID = null;
    this.testRowID = null;
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    TestUtils.log('开始运行 AttributeViewDB CRUD 测试...');
    
    try {
      // 1. 测试创建功能
      await this.testCreate();
      
      // 2. 测试查询功能
      await this.testRead();
      
      // 3. 测试更新功能
      await this.testUpdate();
      
      // 4. 测试删除功能
      await this.testDelete();
      
      TestUtils.success('所有测试完成！');
      
    } catch (error) {
      TestUtils.error('测试过程中发生错误', error);
    }
  }

  /**
   * 测试创建功能 (Create)
   */
  async testCreate() {
    TestUtils.log('=== 测试创建功能 ===');
    
    try {
      // 1. 创建属性视图
      TestUtils.log('1. 创建属性视图...');
      const newView = await this.db.createAttributeView('测试属性视图');
      this.testAvID = newView.id;
      TestUtils.success(`属性视图创建成功，ID: ${this.testAvID}`);
      
      // 2. 插入新列
      TestUtils.log('2. 插入新列...');
      const columnResult = await this.db.insertAttributeViewColumn(this.testAvID, {
        type: 'text',
        name: '测试列'
      });
      this.testColumnID = columnResult.id;
      TestUtils.success(`列插入成功，ID: ${this.testColumnID}`);
      
      // 3. 插入新行
      TestUtils.log('3. 插入新行...');
      const rowResult = await this.db.insertAttributeViewRow(this.testAvID, {
        blockID: 'test-block-123'
      });
      this.testRowID = rowResult.id;
      TestUtils.success(`行插入成功，ID: ${this.testRowID}`);
      
      // 4. 添加选项值（用于select类型列）
      TestUtils.log('4. 添加选项值...');
      await this.db.insertAttributeViewValue(this.testAvID, this.testColumnID, '选项1');
      await this.db.insertAttributeViewValue(this.testAvID, this.testColumnID, '选项2');
      TestUtils.success('选项值添加成功');
      
      TestUtils.success('创建功能测试完成');
      
    } catch (error) {
      TestUtils.error('创建功能测试失败', error);
      throw error;
    }
  }

  /**
   * 测试查询功能 (Read)
   */
  async testRead() {
    TestUtils.log('=== 测试查询功能 ===');
    
    try {
      // 1. 获取所有属性视图
      TestUtils.log('1. 获取所有属性视图...');
      const allViews = await this.db.getAllAttributeViews();
      TestUtils.success(`获取到 ${allViews.length} 个属性视图`);
      
      // 2. 获取单个属性视图
      TestUtils.log('2. 获取单个属性视图...');
      const singleView = await this.db.getAttributeView(this.testAvID);
      TestUtils.success(`属性视图名称: ${singleView.name}`);
      
      // 3. 渲染属性视图
      TestUtils.log('3. 渲染属性视图...');
      const renderedView = await this.db.renderAttributeView(this.testAvID, {
        page: 1,
        pageSize: 10
      });
      TestUtils.success('属性视图渲染成功');
      
      // 4. 获取列定义
      TestUtils.log('4. 获取列定义...');
      const columns = await this.db.getAttributeViewKeys(this.testAvID);
      TestUtils.success(`获取到 ${columns.length} 个列定义`);
      
      // 5. 获取行数据
      TestUtils.log('5. 获取行数据...');
      const rows = await this.db.getAttributeViewRows(this.testAvID, {
        page: 1,
        pageSize: 10
      });
      TestUtils.success(`获取到 ${rows.length} 行数据`);
      
      // 6. 搜索属性视图
      TestUtils.log('6. 搜索属性视图...');
      const searchResults = await this.db.searchAttributeView(this.testAvID, '测试', {
        page: 1,
        pageSize: 10
      });
      TestUtils.success('搜索功能正常');
      
      TestUtils.success('查询功能测试完成');
      
    } catch (error) {
      TestUtils.error('查询功能测试失败', error);
      throw error;
    }
  }

  /**
   * 测试更新功能 (Update)
   */
  async testUpdate() {
    TestUtils.log('=== 测试更新功能 ===');
    
    try {
      // 1. 更新属性视图名称
      TestUtils.log('1. 更新属性视图名称...');
      await this.db.updateAttributeView(this.testAvID, {
        name: '更新后的测试属性视图'
      });
      TestUtils.success('属性视图名称更新成功');
      
      // 2. 设置单元格值
      TestUtils.log('2. 设置单元格值...');
      await this.db.setAttributeViewBlockAttr(this.testAvID, 'test-block-123', this.testColumnID, '测试值');
      TestUtils.success('单元格值设置成功');
      
      // 3. 更新列属性
      TestUtils.log('3. 更新列属性...');
      await this.db.updateAttributeViewColumn(this.testAvID, this.testColumnID, {
        name: '更新后的测试列',
        width: 200
      });
      TestUtils.success('列属性更新成功');
      
      // 4. 设置筛选规则
      TestUtils.log('4. 设置筛选规则...');
      const filter = {
        id: 'test-filter',
        rules: [
          {
            column: this.testColumnID,
            operator: 'is',
            value: '测试值'
          }
        ],
        conjunction: 'and'
      };
      await this.db.setAttributeViewFilter(this.testAvID, 'table', filter);
      TestUtils.success('筛选规则设置成功');
      
      // 5. 设置排序规则
      TestUtils.log('5. 设置排序规则...');
      const sort = {
        column: this.testColumnID,
        order: 'asc'
      };
      await this.db.setAttributeViewSort(this.testAvID, 'table', sort);
      TestUtils.success('排序规则设置成功');
      
      TestUtils.success('更新功能测试完成');
      
    } catch (error) {
      TestUtils.error('更新功能测试失败', error);
      throw error;
    }
  }

  /**
   * 测试删除功能 (Delete)
   */
  async testDelete() {
    TestUtils.log('=== 测试删除功能 ===');
    
    try {
      // 1. 删除选项值
      TestUtils.log('1. 删除选项值...');
      await this.db.deleteAttributeViewValue(this.testAvID, this.testColumnID, '选项1');
      TestUtils.success('选项值删除成功');
      
      // 2. 清除筛选规则
      TestUtils.log('2. 清除筛选规则...');
      await this.db.clearAttributeViewFilter(this.testAvID, 'table');
      TestUtils.success('筛选规则清除成功');
      
      // 3. 清除排序规则
      TestUtils.log('3. 清除排序规则...');
      await this.db.clearAttributeViewSort(this.testAvID, 'table');
      TestUtils.success('排序规则清除成功');
      
      // 4. 删除行
      TestUtils.log('4. 删除行...');
      await this.db.deleteAttributeViewRow(this.testAvID, this.testRowID);
      TestUtils.success('行删除成功');
      
      // 5. 删除列
      TestUtils.log('5. 删除列...');
      await this.db.deleteAttributeViewColumn(this.testAvID, this.testColumnID);
      TestUtils.success('列删除成功');
      
      // 6. 删除整个属性视图
      TestUtils.log('6. 删除整个属性视图...');
      await this.db.removeAttributeView(this.testAvID);
      TestUtils.success('属性视图删除成功');
      
      TestUtils.success('删除功能测试完成');
      
    } catch (error) {
      TestUtils.error('删除功能测试失败', error);
      throw error;
    }
  }

  /**
   * 测试错误处理
   */
  async testErrorHandling() {
    TestUtils.log('=== 测试错误处理 ===');
    
    try {
      // 1. 测试无效的avID
      TestUtils.log('1. 测试无效的avID...');
      try {
        await this.db.getAttributeView('');
        TestUtils.error('应该抛出错误但没有抛出');
      } catch (error) {
        TestUtils.success('正确捕获了无效avID错误');
      }
      
      // 2. 测试不存在的avID
      TestUtils.log('2. 测试不存在的avID...');
      try {
        await this.db.getAttributeView('non-existent-id');
        TestUtils.error('应该抛出错误但没有抛出');
      } catch (error) {
        TestUtils.success('正确捕获了不存在avID错误');
      }
      
      // 3. 测试缺少必需参数
      TestUtils.log('3. 测试缺少必需参数...');
      try {
        await this.db.setAttributeViewBlockAttr('', '', '', '');
        TestUtils.error('应该抛出错误但没有抛出');
      } catch (error) {
        TestUtils.success('正确捕获了缺少参数错误');
      }
      
      TestUtils.success('错误处理测试完成');
      
    } catch (error) {
      TestUtils.error('错误处理测试失败', error);
      throw error;
    }
  }
}

/**
 * 运行测试
 */
async function runTests() {
  const tester = new AttributeViewDBTest();
  
  try {
    // 运行主要功能测试
    await tester.runAllTests();
    
    // 等待一段时间后运行错误处理测试
    await TestUtils.delay(2000);
    await tester.testErrorHandling();
    
    TestUtils.log('🎉 所有测试完成！');
    
  } catch (error) {
    TestUtils.error('测试运行失败', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行测试
if (import.meta.url.endsWith('test-crud.js')) {
  runTests();
}

export { AttributeViewDBTest, TestUtils };
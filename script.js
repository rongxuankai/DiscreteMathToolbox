// 生成命题按钮
function generatePropositionButtons() {
    const container = document.querySelector('.proposition-buttons');
    for (let i = 65; i <= 90; i++) { // A-Z的ASCII码
        const letter = String.fromCharCode(i);
        const button = document.createElement('button');
        button.textContent = letter;
        button.onclick = () => addOperator(letter);
        container.appendChild(button);
    }
}

// 添加操作符到输入框
function addOperator(op) {
    const input = document.getElementById('expression');
    input.value += op;
}

// 清除输入
function clearExpression() {
    document.getElementById('expression').value = '';
    document.getElementById('dnf').textContent = '';
    document.getElementById('cnf').textContent = '';
    document.getElementById('truth-table').innerHTML = '';
}

// 检查表达式合法性
function isValidExpression(expr) {
    // 检查括号匹配
    let stack = [];
    for (let char of expr) {
        if (char === '(') {
            stack.push(char);
        } else if (char === ')') {
            if (stack.length === 0) return false;
            stack.pop();
        }
    }
    if (stack.length > 0) {
        alert('错误：括号不匹配！');
        return false;
    }

    // 检查运算符前后是否合法
    const operators = ['∧', '∨', '→', '⇔', '↑', '↓'];
    const chars = expr.split('');
    
    for (let i = 0; i < chars.length; i++) {
        // 检查运算符前后必须有操作数
        if (operators.includes(chars[i])) {
            if (i === 0 || i === chars.length - 1) {
                alert('错误：运算符不能在开头或结尾！');
                return false;
            }
            // 检查运算符前后不能是其他运算符
            if (operators.includes(chars[i-1]) || operators.includes(chars[i+1])) {
                alert('错误：运算符不能相邻！');
                return false;
            }
        }
        
        // 检查否定符号后面必须跟变量或左括号
        if (chars[i] === '¬') {
            if (i === chars.length - 1) {
                alert('错误：否定符号后面必须有操作数！');
                return false;
            }
            if (!(chars[i+1].match(/[A-Z]/) || chars[i+1] === '(')) {
                alert('错误：否定符号后面必须是变量或左括号！');
                return false;
            }
        }
    }

    return true;
}

// 优化后的计算函数
function calculate() {
    const expression = document.getElementById('expression').value;
    if (!expression) {
        alert('请输入表达式！');
        return;
    }

    if (!isValidExpression(expression)) {
        return;
    }

    const variables = [...new Set(expression.match(/[A-Z]/g))].sort();
    if (variables.length > 8) {
        alert('变量数量过多，可能导致计算缓慢！最多支持8个变量。');
        return;
    }

    try {
        const rows = Math.pow(2, variables.length);
        const truthTable = [];
        
        // 使用 Web Worker 处理大量计算
        if (variables.length > 4) {
            const worker = new Worker(createWorkerScript());
            worker.postMessage({ expression, variables });
            
            worker.onmessage = function(e) {
                const { truthTable, error } = e.data;
                if (error) {
                    alert('计算出错：' + error);
                    return;
                }
                displayTruthTable(truthTable, variables);
                generateNormalForms(truthTable, variables);
            };
        } else {
            // 对于简单表达式直接计算
            for (let i = 0; i < rows; i++) {
                const row = {};
                variables.forEach((variable, index) => {
                    row[variable] = (i & (1 << (variables.length - 1 - index))) !== 0;
                });
                row.result = evaluateExpression(expression, row);
                truthTable.push(row);
            }
            displayTruthTable(truthTable, variables);
            generateNormalForms(truthTable, variables);
        }
    } catch (error) {
        alert('计算出错：' + error.message);
    }
}

// 创建 Web Worker 脚本
function createWorkerScript() {
    const blob = new Blob([`
        self.onmessage = function(e) {
            const { expression, variables } = e.data;
            try {
                const rows = Math.pow(2, variables.length);
                const truthTable = [];
                
                for (let i = 0; i < rows; i++) {
                    const row = {};
                    variables.forEach((variable, index) => {
                        row[variable] = (i & (1 << (variables.length - 1 - index))) !== 0;
                    });
                    row.result = evaluateExpression(expression, row);
                    truthTable.push(row);
                }
                
                self.postMessage({ truthTable });
            } catch (error) {
                self.postMessage({ error: error.message });
            }
        };

        ${evaluateExpression.toString()}
    `], { type: 'application/javascript' });
    
    return URL.createObjectURL(blob);
}

// 优化表达式求值函数
function evaluateExpression(expression, values) {
    let expr = expression;
    
    // 替换变量为真值
    for (let variable in values) {
        expr = expr.replace(new RegExp(variable, 'g'), values[variable] ? '1' : '0');
    }

    // 处理括号
    while (expr.includes('(')) {
        expr = expr.replace(/\(([^()]+)\)/g, (match, group) => {
            return evaluateSimpleExpression(group);
        });
    }

    return evaluateSimpleExpression(expr) === '1';
}

// 处理简单表达式（不含括号）
function evaluateSimpleExpression(expr) {
    // 处理否定
    while (expr.includes('¬')) {
        expr = expr.replace(/¬(0|1)/g, match => 
            match[1] === '0' ? '1' : '0'
        );
    }

    // 处理与非运算
    while (expr.includes('↑')) {
        expr = expr.replace(/([01])↑([01])/g, (match, p1, p2) => 
            (p1 === '1' && p2 === '1') ? '0' : '1'
        );
    }

    // 处理或非运算
    while (expr.includes('↓')) {
        expr = expr.replace(/([01])↓([01])/g, (match, p1, p2) => 
            (p1 === '1' || p2 === '1') ? '0' : '1'
        );
    }

    // 处理蕴含
    while (expr.includes('→')) {
        expr = expr.replace(/([01])→([01])/g, (match, p1, p2) => 
            (p1 === '1' && p2 === '0') ? '0' : '1'
        );
    }

    // 处理等价
    while (expr.includes('⇔')) {
        expr = expr.replace(/([01])⇔([01])/g, (match, p1, p2) => 
            p1 === p2 ? '1' : '0'
        );
    }

    // 处理与运算
    while (expr.includes('∧')) {
        expr = expr.replace(/([01])∧([01])/g, (match, p1, p2) => 
            (p1 === '1' && p2 === '1') ? '1' : '0'
        );
    }

    // 处理或运算
    while (expr.includes('∨')) {
        expr = expr.replace(/([01])∨([01])/g, (match, p1, p2) => 
            (p1 === '1' || p2 === '1') ? '1' : '0'
        );
    }

    return expr;
}

// 显示真值表
function displayTruthTable(truthTable, variables) {
    const table = document.createElement('table');
    
    // 表头
    const header = document.createElement('tr');
    variables.forEach(v => {
        const th = document.createElement('th');
        th.textContent = v;
        header.appendChild(th);
    });
    const resultTh = document.createElement('th');
    resultTh.textContent = '结果';
    header.appendChild(resultTh);
    table.appendChild(header);

    // 表格内容
    truthTable.forEach(row => {
        const tr = document.createElement('tr');
        variables.forEach(v => {
            const td = document.createElement('td');
            td.textContent = row[v] ? '1' : '0';
            tr.appendChild(td);
        });
        const resultTd = document.createElement('td');
        resultTd.textContent = row.result ? '1' : '0';
        tr.appendChild(resultTd);
        table.appendChild(tr);
    });

    document.getElementById('truth-table').innerHTML = '';
    document.getElementById('truth-table').appendChild(table);
}

// 生成主析取范式和主合取范式
function generateNormalForms(truthTable, variables) {
    let dnf = [];
    let cnf = [];
    let minterms = [];
    let maxterms = [];

    truthTable.forEach((row, index) => {
        if (row.result) { // DNF and minterms
            const term = variables.map(v => 
                row[v] ? v : `¬${v}`
            ).join('∧');
            dnf.push(term);
            minterms.push(index);
        } else { // CNF and maxterms
            const term = variables.map(v => 
                !row[v] ? v : `¬${v}`
            ).join('∨');
            cnf.push(term);
            maxterms.push(index);
        }
    });

    document.getElementById('dnf').textContent = dnf.length ? dnf.join('∨') : '0';
    document.getElementById('cnf').textContent = cnf.length ? cnf.join('∧') : '1';
    
    // 显示极小项和极大项
    document.getElementById('minterms').textContent = minterms.length ? 
        `m(${minterms.join(',')})` : 
        '∅';
    document.getElementById('maxterms').textContent = maxterms.length ? 
        `M(${maxterms.join(',')})` : 
        '∅';
}

// 删除最后一个字符
function deleteLastChar() {
    const input = document.getElementById('expression');
    input.value = input.value.slice(0, -1);
}

// 获取表达式的对偶式
function getDual() {
    const input = document.getElementById('expression');
    const expr = input.value;
    if (!expr) {
        alert('请先输入表达式！');
        return;
    }

    let dual = expr
        .replace(/∧/g, '_AND_')  // 临时替换，避免冲突
        .replace(/∨/g, '_OR_')
        .replace(/↑/g, '_NAND_')
        .replace(/↓/g, '_NOR_')
        .replace(/_AND_/g, '∨')  // 替换回最终符号
        .replace(/_OR_/g, '∧')
        .replace(/_NAND_/g, '↓')
        .replace(/_NOR_/g, '↑');

    document.getElementById('dual').textContent = dual;
}

// 页面加载时初始化
window.onload = function() {
    generatePropositionButtons();
}; 